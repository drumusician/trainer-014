// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Proef",
    platforms: [.macOS(.v13)],
    dependencies: [
        .package(url: "https://github.com/powersync-ja/powersync-swift.git", from: "1.14.0")
    ],
    targets: [
        .executableTarget(
            name: "Proef",
            dependencies: [.product(name: "PowerSync", package: "powersync-swift")]
        )
    ]
)
