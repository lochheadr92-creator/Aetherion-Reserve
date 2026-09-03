#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
user_problem_statement: "Stabilisation pass (post-Phase F review of d034801). Items 1-8 only, no features. 1) deserialize backfills state.knowledge for every species; 2) newborns never placed across a fence (adjacentOpenTile honours fenceBetween, falls back to the mother's tile); 3) ErrorBoundary around <App/> (components/ErrorBoundary.jsx, wired in index.js) + GameCanvas rAF try/catch that keeps the loop alive; 4) App.handleLoad try/catch + toast, controller.loadGame builds the state locally before assigning; 5) ContractsTab no longer refreshes contracts during render (controller.newGame refreshes once); 6) deterministic RNG: getRngState/setRngState, createNewGame({seed}) -> state.seed, serialize writes rngState, deserialize restores it (legacy rng key read; missing seed -> null); 7) tests read AETHERION_URL via tests/config.py, every save-creating test cleans up in finally (tests/save_cleanup.py), new determinism_test / save_compat_test / birth_boundary_test; 8) .env.example files, README, backend list cap 200 + indexes (id, updated_at, owner+updated_at). Kept from Phase H by user decision: per-browser save scoping (X-Player-Token), deserialize also drops unknown research ids / building types / species. Default seed stays 12345 (user decision)."

backend:
  - task: "Item 8: list cap 200 + startup indexes (id unique, updated_at, owner+updated_at); save scoping unchanged"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "LIST_DEFAULT raised to 200 (LIST_MAX 200, ?limit validated 1..200, ?skip). Indexes created at startup. Local: backend_api_test 6/6, backend_regression 19/19, backend/backend_test 11/11, assessment_fixes H5.1-H5.8 pass. DB purged of 75 leftover test saves; every suite now deletes what it creates."

frontend:
  - task: "Item 1: deserialize backfills knowledge for all 19 species (+ drops unknown research/buildings/species)"
    implemented: true
    working: "NA"
    file: "frontend/src/game/state.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "tests/save_compat_test.py 6/6 (save lacking knowledge.skitter loads with the slot backfilled, 300 ticks no throw). assessment_fixes H2.1-H2.4 pass."
  - task: "Item 2: adjacentOpenTile skips fenceBetween candidates, returns mother's tile when none"
    implemented: true
    working: "NA"
    file: "frontend/src/game/creatures.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "tests/birth_boundary_test.py 7/7: mother pinned on the east boundary tile gives birth INSIDE the pen (west), baby.enclosureId === mother's, escaped false."
  - task: "Item 3: ErrorBoundary (components/ErrorBoundary.jsx wrapping <App/> in index.js) + GameCanvas render try/catch"
    implemented: true
    working: "NA"
    file: "frontend/src/components/ErrorBoundary.jsx, frontend/src/index.js, frontend/src/components/game/GameCanvas.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "data-testid error-boundary / error-boundary-home / error-boundary-retry. Back to menu -> game.stopLoop() + remount on the main menu. rAF loop logs a render exception once per distinct message and keeps scheduling. assessment_fixes H3.1/H3.2 pass (in dev builds remove #webpack-dev-server-client-overlay before clicking)."
  - task: "Item 4: load failures surface (App.handleLoad toast; controller.loadGame builds state locally first)"
    implemented: true
    working: "NA"
    file: "frontend/src/App.js, frontend/src/game/controller.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "assessment_fixes M3.1 pass (aborted GET -> toast 'Could not load save', menu stays)."
  - task: "Item 5: ContractsTab no render-time refreshContracts; controller.newGame refreshes once"
    implemented: true
    working: "NA"
    file: "frontend/src/components/game/fieldops/ContractsTab.jsx, frontend/src/game/controller.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "phase5_test TEST 4a-4c (contract offers visible immediately, accept, complete + payout) pass."
  - task: "Item 6: seeded RNG in state (seed, rngState) with exact replay on load"
    implemented: true
    working: "NA"
    file: "frontend/src/game/state.js, frontend/src/game/controller.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "tests/determinism_test.py 8/8: A two fresh page loads seed 4242 -> identical hash at tick 900; B continue-to-900 == save@300/load/run-to-900; C same seed twice hashes identically at tick 0. window.__gameDebug exposes getRngState/serialize/deserialize/adjacentOpenTile/playerToken."
  - task: "Item 7: tests/config.py (AETHERION_URL), save cleanup in finally, three new suites"
    implemented: true
    working: "NA"
    file: "tests/config.py, tests/save_cleanup.py, tests/determinism_test.py, tests/save_compat_test.py, tests/birth_boundary_test.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "31 suites + backend_test.py + backend/backend_test.py import config. Acceptance order run locally, all green: determinism 8/8, save_compat 6/6, birth_boundary 7/7, smoke_game, phase20 39/39, phase21 28/28, phase17 all PASS."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 22
  run_ui: true

test_plan:
  current_focus:
    - "Item 1: deserialize backfills knowledge for all 19 species (+ drops unknown research/buildings/species)"
    - "Item 2: adjacentOpenTile skips fenceBetween candidates, returns mother's tile when none"
    - "Item 3: ErrorBoundary (components/ErrorBoundary.jsx wrapping <App/> in index.js) + GameCanvas render try/catch"
    - "Item 4: load failures surface (App.handleLoad toast; controller.loadGame builds state locally first)"
    - "Item 5: ContractsTab no render-time refreshContracts; controller.newGame refreshes once"
    - "Item 6: seeded RNG in state (seed, rngState) with exact replay on load"
    - "Item 7: tests/config.py (AETHERION_URL), save cleanup in finally, three new suites"
    - "Item 8: list cap 200 + startup indexes (id unique, updated_at, owner+updated_at); save scoping unchanged"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Stabilisation pass complete locally (items 1-8). Please verify items 1-7 against the referenced files/tests, run browser suites ONE AT A TIME, and DELETE every save you create (X-Player-Token header if you create via the browser; legacy saves without a token can be deleted without one). The database must contain no saves named 'determinism-b' or 'compat-test' when you finish. Report as iteration_22."
