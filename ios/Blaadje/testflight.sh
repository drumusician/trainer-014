#!/usr/bin/env bash
# Maakt een archief en stuurt het naar TestFlight. Het buildnummer hoogt Apple
# zelf op. Xcode moet zijn ingelogd met het team uit project.yml.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
xcodebuild -project Blaadje.xcodeproj -scheme Blaadje -destination "generic/platform=iOS" \
  -archivePath .bouw/Blaadje.xcarchive -allowProvisioningUpdates archive | grep -E "error|ARCHIVE"
xcodebuild -exportArchive -archivePath .bouw/Blaadje.xcarchive -exportOptionsPlist opsturen.plist \
  -exportPath .bouw/opgestuurd -allowProvisioningUpdates 2>&1 | grep -E "error|Upload succeeded|EXPORT"
