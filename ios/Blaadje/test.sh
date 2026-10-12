#!/usr/bin/env bash
# Draait de tests van de app in de simulator. Zonder argument alles; met een
# naam alleen die test, bijvoorbeeld:
#   ./test.sh BlaadjeSchermTests/WedstrijddagTests/testEenNieuwTeamOpzetten
# Schermafdrukken van de schermtests komen in de map uit BEELDEN, als die gezet is.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
alleen=()
[ $# -gt 0 ] && alleen=(-only-testing:"$1")
TEST_RUNNER_PROEF_BEELDEN="${BEELDEN:-}" xcodebuild -project Blaadje.xcodeproj -scheme Blaadje \
  -destination "platform=iOS Simulator,name=${TOESTEL:-iPhone 17}" -derivedDataPath .bouw \
  -collect-test-diagnostics never test "${alleen[@]}" 2>&1 |
  grep -E "error:|Test Case.*(passed|failed)|TEST (SUCCEEDED|FAILED)|BUILD FAILED" | sed 's|.*/ios/Blaadje/||'
exit "${PIPESTATUS[0]}"
