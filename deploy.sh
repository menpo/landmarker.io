#!/usr/bin/env bash
#
# Staging and deployment script for landmarker.io static frontend
# Runs automatically from travis buils if secure GH_TOKEN is setup to allow
# git pushes
#
# This script assumes a clean state and enforces it, stash any untracked changes
# when using locally. This is to ensure we only deploy 'good' files.
#

DEPLOY_BRANCH="master"      # Will be mirrored at the root
MANIFETS="lmio.appcache"    # Used to check if build has happened

# Set up for travis environment (branch, repo with push rights)
# If running locally, the repo and user will automatically be the ones from the
# current shell session.
if [ "$TRAVIS" == "true" ]; then
  echo "Setting up correct remote for Travis..."

  git config --global user.name "Travis-CI"
  git config --global push.default simple

  [[ -z "$GH_TOKEN" ]] && echo "Missing GH_TOKEN env variable, can't deploy" && exit 1

  REPO="https://$GH_TOKEN@github.com/$TRAVIS_REPO_SLUG"
  git remote rename origin origin.bak
  git remote add origin $REPO  > /dev/null 2>&1 || exit 1
  git remote remove origin.bak

  BRANCH="$TRAVIS_BRANCH"
  SLUG="$TRAVIS_REPO_SLUG"
  ACTOR="TRAVIS"
else
  BRANCH=$(git rev-parse --abbrev-ref HEAD)
  SLUG=$(git config --get remote.origin.url)
  SLUG=${SLUG#git@github.com:}
  SLUG=${SLUG%.git}
  ACTOR="LOCAL"
fi

shopt -s extglob

git fetch --all  > /dev/null 2>&1 || exit 1 # Make sure we have the latest state

echo "Building gh-pages branch for $BRANCH..."

# Assume manifest present means build has happened, otherwise rebuild
[[ ! -e "$MANIFEST" ]] && npm run build

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
