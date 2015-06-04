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

DEPLOY_BRANCH="master"      # Will be mirrored at the root of gh-pages
MANIFEST="lmio.appcache"    # Used to check if build has happened

if [ "$TRAVIS" == "true" ]; then
  # Set up for travis environment (branch, repo with push rights)
  if [ "$TRAVIS_PULL_REQUEST" != "false" ]; then
    echo "Travis should not deploy from pull requests" && exit 0
  fi

  echo "Setting up correct remote for Travis"

  git config --global user.name "Travis-CI"
  git config --global push.default simple

  [[ -z "$ENCRYPTION_LABEL" ]] && "Missing ENCRYPTION_LABEL env variable" && exit 1

  ENCRYPTED_KEY_VAR=encrypted_${ENCRYPTION_LABEL}_key
  ENCRYPTED_IV_VAR=encrypted_${ENCRYPTION_LABEL}_iv
  ENCRYPTED_KEY=${!ENCRYPTED_KEY_VAR}
  ENCRYPTED_IV=${!ENCRYPTED_IV_VAR}

  [[ -z "$ENCRYPTED_KEY" || -z "$ENCRYPTED_IV" ]] && echo "Unable to retrieve $ENCRYPTED_KEY_VAR or $ENCRYPTED_IV_VAR" && exit 1

  echo "Decrypting key for label $ENCRYPTION_LABEL"

  # Decrypt the key ecnrypted with travis encrypt-file and add to ssh-agent
  openssl aes-256-cbc -K "$ENCRYPTED_KEY" -iv "$ENCRYPTED_IV" -in id_rsa.enc -out id_rsa -d
  chmod 600 id_rsa
  eval `ssh-agent -s`
  ssh-add id_rsa

  # Ensure correct ssh remote
  REPO="git@github.com:/$TRAVIS_REPO_SLUG.git"
  git remote rename origin origin.bak > /dev/null 2>&1 || exit 1
  git remote add origin $REPO  > /dev/null 2>&1 || exit 1
  git remote remove origin.bak > /dev/null 2>&1 || exit 1

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

git fetch --all  > /dev/null 2>&1 || exit 1 # Make sure we have the latest state

echo "Building gh-pages branch for $BRANCH"

# Assume manifest present means build has happened, otherwise rebuild
[[ ! -e "$MANIFEST" ]] && npm run build || echo "Already built"

TMP_DIR=$(mktemp -d "/tmp/landmarker-build-$BRANCH-XXXX")
mv ./index.html ./bundle-*.* ./*.appcache ./img ./api "$TMP_DIR"

# Switch to latests gh-pages branch and enforce correct content
git checkout gh-pages > /dev/null 2>&1 || exit 1
git clean -f > /dev/null 2>&1 || exit 1
git reset --hard > /dev/null 2>&1 || exit 1

rm -rf "staging/$BRANCH" 2>&1 || exit 1
mv -f "$TMP_DIR" "staging/$BRANCH" 2>&1 || exit 1

echo "Deploying $BRANCH to staging/$BRANCH..."

# Update staging/index.html file to link to newly deployed branch
LINK="<li><a id='$BRANCH' href='$BRANCH'>$BRANCH ($(date))</a></li>"
LN=$(awk '/end automatic insert/{ print NR; exit }' staging/index.html)
sed -i "/id='$BRANCH'/d" staging/index.html 2>&1 || exit 1
sed -i "${LN}i${LINK}" staging/index.html

# master branch is staged but we mirror it at root level
# Commented out for now to avoid any risk on the deployed branch git

# if [[ "$BRANCH" == "$DEPLOY_BRANCH" ]]; then
#   rm -fr ./index.html ./bundle-*.* ./*.appcache ./img ./api
#   cp -r "staging/$BRANCH"/* .
# fi

# Save updates to repository
git status -s > /dev/null 2>&1 || exit 1
git add -A . > /dev/null 2>&1 || exit 1
git commit --allow-empty -m "[deploy.sh | $ACTOR] $BRANCH ($(date))" > /dev/null 2>&1 || exit 1
git push > /dev/null 2>&1 || exit 1

# Clean up
rm -rf "$TMP_DIR"
shopt -u extglob
