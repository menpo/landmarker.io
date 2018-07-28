#!/usr/bin/env bash
#
# Staging and deployment script for landmarker.io static frontend
# Runs automatically from travis buils if secure GH_TOKEN is setup to allow
# git pushes
#
# This script assumes a clean state and enforces it, stash any untracked changes
# when using locally. This is to ensure we only deploy 'good' files.
#
# To allow push access we encrypt the deploy key into the .travis.yml file, see
# https://gist.github.com/pghalliday/240fe740d523dad21d3f and
# http://docs.travis-ci.com/user/encrypting-files/ for more information
#

MANIFEST="./build/lmio.appcache"     # Used to check if build has happened

if [ "$TRAVIS" == "true" ]; then
  # Set up for travis environment (branch, repo with push rights)
  if [ "$TRAVIS_PULL_REQUEST" != "false" ]; then
    echo "Travis should not deploy from pull requests" && exit 0
  fi

  echo "Setting up correct remote for Travis"

  git config --global user.name "Travis-CI"
  git config --global user.email "$TRAVIS_BUILD_NUMBER-$TRAVIS_JOB_ID@travis-ci.org"
  git config --global push.default simple

  [[ -z "$ENCRYPTION_LABEL" ]] && "Missing ENCRYPTION_LABEL env variable" && exit 1

  ENCRYPTED_KEY_VAR=encrypted_${ENCRYPTION_LABEL}_key
  ENCRYPTED_IV_VAR=encrypted_${ENCRYPTION_LABEL}_iv
  ENCRYPTED_KEY=${!ENCRYPTED_KEY_VAR}
  ENCRYPTED_IV=${!ENCRYPTED_IV_VAR}

  [[ -z "$ENCRYPTED_KEY" || -z "$ENCRYPTED_IV" ]] && echo "Unable to retrieve $ENCRYPTED_KEY_VAR or $ENCRYPTED_IV_VAR" && exit 1

  echo "Decrypting key for label $ENCRYPTION_LABEL"

  # Decrypt the key encrypted with travis encrypt-file and add to ssh-agent
  openssl aes-256-cbc -K "$ENCRYPTED_KEY" -iv "$ENCRYPTED_IV" -in id_rsa.enc -out id_rsa -d
  chmod 600 id_rsa
  eval "$(ssh-agent -s)"
  ssh-add id_rsa

  # Ensure correct ssh remote
  REPO="git@github.com:/$TRAVIS_REPO_SLUG.git"
  git remote rename origin origin.bak
  git remote add origin "$REPO"
  git remote remove origin.bak

  # Setup som useful variables for tracking
  BRANCH="$TRAVIS_BRANCH"
  SLUG="$TRAVIS_REPO_SLUG"
  ACTOR="TRAVIS"

else
  # Running locally, use the current directory's repo and branch
  BRANCH=$(git rev-parse --abbrev-ref HEAD)
  SLUG=$(git config --get remote.origin.url)
  SLUG=${SLUG#git@github.com:}
  SLUG=${SLUG%.git}
  ACTOR="LOCAL"
fi

shopt -s extglob

# Make sure we have the latest state
git fetch --all || exi 1;
LAST_COMMIT=$(git log -n 1 --pretty=oneline)

echo "Building gh-pages branch for $BRANCH"

# Assume manifest present means build has happened, otherwise rebuild
if [[ ! -e "$MANIFEST" ]]; then  npm run build || exit 1; else echo "Already built"; fi

TMP_DIR=$(mktemp -d "/tmp/landmarker-build-$BRANCH-XXXX")
mv ./build/* "$TMP_DIR"

# Switch to latest gh-pages branch and enforce correct content
git checkout gh-pages || exit 1
git clean -f
git reset --hard

rm -rf "staging/$BRANCH"
mv -f "$TMP_DIR" "staging/$BRANCH"

echo "Deploying $BRANCH to staging/$BRANCH..."

# Update staging/index.html file to link to newly deployed branch
LINK="<li><a id='$BRANCH' href='$BRANCH'>$BRANCH ($(date) | $LAST_COMMIT</a></li>"
LN=$(awk '/end automatic insert/{ print NR; exit }' staging/index.html)
echo "($LN) $LINK"
sed -i "/id='$BRANCH'/d" staging/index.html
sed -i "${LN}i${LINK}" staging/index.html
echo "Updated staging/index.html to point to staging/$BRANCH and moved build files"
ls "staging/$BRANCH"

# tags are deployed at root
if [[ ! -z "$TRAVIS_TAG" ]]; then
  echo "Deploying tag $TRAVIS_TAG"
  # clean out everything that's non gh-pages specific
  ls  | grep -vw 'v1\|legacy\|staging\|CNAME' | xargs rm -r
  cp -r "staging/$BRANCH"/* .
fi

# Clean up old tags (only keep 3)
for i in $(find staging -name "v*.*.*" | sort | head -n -3); do
  TAG_NAME=$(basename "$i")
  echo "Removing $TAG_NAME"
  sed -i "/id='$TAG_NAME'/d" staging/index.html
  git rm -rf "staging/$TAG_NAME"
done

# Save updates to repository
git status -s
git add -A .
git commit --allow-empty -m "[deploy.sh | $ACTOR] $BRANCH ($(date))" || exit 1;
git push || exit 1;

# Clean up
rm -rf "$TMP_DIR"

shopt -u extglob
