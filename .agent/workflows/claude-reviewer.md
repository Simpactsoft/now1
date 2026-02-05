---
description: Perform a comprehensive code review of recent changes
---

1. **Identify Recent Changes**:
   - Run `git status` to see uncommitted changes.
   - Run `git diff` to view the details of uncommitted changes.
   - If there are no uncommitted changes, run `git diff HEAD~1` to review the last commit.

2. **Analyze Code Quality**:
   - **Bugs & Logic**: Check for potential runtime errors, null pointer exceptions, and logical flaws.
   - **Security**: Verify input validation, permission checks, and data exposure (RLS policies).
   - **Performance**: Look for N+1 queries, unnecessary re-renders, or expensive operations.
   - **Typing**: Identify excessively loose types (`any`) or missing interfaces.
   - **Best Practices**: Ensure code follows project patterns (e.g., standardizing on specific libraries, file modularity).

3. **Generate Review Report**:
   - Provide a Markdown summary of findings.
   - Group findings into:
     - 🔴 **Critical**: Must fix immediately (bugs, security).
     - 🟡 **Warnings**: Should fix (potential issues, messy code).
     - 🟢 **Suggestions**: Nice to have (refactoring, comments).
   - Provide concrete usage examples or corrected code snippets for every issue found.

4. **Action Plan**:
   - Ask the user which of the critical or warning items they would like you to fix immediately.
