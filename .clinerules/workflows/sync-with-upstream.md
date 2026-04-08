# Upstream change synchronisation workflow

This workflow pulls changes from the upstream repository and integrates them into the main branch.

## Boundaries

- You MUST always follow instructions exactly.
- You MUST execute the workflow steps sequentially one at a time.
- You MUST execute next step ONLY after completing the previous one successfully.
- You MUST stop the workflow execution immediately if a step fails.
- You MUST ask the user how to proceed if you encounter any ambiguity.

## Step 1: Switch to main branch

Switch the workspace to `main` branch.

## Step 2: Check for uncommitted changes

Check for uncommitted changes (including untracked files) on `main` branch. If there are any, let the user know and ask whether to proceed.

## Step 3: Check for unpublished changes

Check for commits on `main` branch not yet pushed to `origin/main`. If there are any, let the user know and ask whether to proceed.

## Step 4: Check if main and upstream branches are in sync

Run this command to check for commits on `upstream` branch that have not been merged to `main` branch yet:

```sh
git log --oneline main..upstream
```

If there are any, let the user and ask whether to proceed.

## Step 5: Sync remote repository with upstream

Run this command to synchronise `upstream` branch of the remote repository with its upstream:

```sh
gh repo sync NeiRo21/solid-client-authn-webext -b upstream
```

If the command fails, provide failure details to the user and ask how to proceed.

## Step 6: Pull changes from remote repository

Run this command to synchronise local `upstream` branch with the remote:

```sh
git fetch origin upstream:upstream
```

If the command fails, provide failure details to the user and ask how to proceed.

## Step 7: Check for new changes in upstream branch

Run this command to check for commits on `upstream` branch that have not been merged to `main` branch yet:

```sh
git log --oneline main..upstream
```

If none, let the user know and complete the workflow execution.

## Step 8: Merge upstream changes into main branch

Merge `upstream` branch into `main` branch.

## Step 9: Resolve conflicts

Check for merge conflicts. If the merge at the previous step succeeded and there are no conflicts, continue to Step 10.

### Step 9.1: Deleted by us

Check for merge conflicts with `deleted by us` cause (i.e. when the user previously deleted the file being merged on `main` branch) - keep such files deleted and mark as resolved.

### Step 9.2: Other conflicts

Ask the user to resolve the outstand merge conflicts and wait for confirmation. Repeat this step until all conflicts are resolved.

## Step 10: Validate merge

Run the standard build workflow to validate the merge. In case of any issues, report them to the user and ask how to proceed.

## Step 11: Commit conflict resolution changes

Proceed to the next step if there are no changes to commit. Otherwise, ask the user if the changes can be committed. If confirmed, complete the merge by committing the changes. Use `Merge branch 'upstream'` commit message. Sign the merge commit.

## Step 12: Prepare to push changes

Present a summary of changes to be pushed to the remote repository to the user.
