// swift-tools-version: 5.9
import PackageDescription

// De koppeling met de server: de tabellen op het toestel (PowerSync) en het
// opsturen naar Supabase. De vertaling tussen toestand en rijen zit in
// BlaadjeKern; hier zit alleen wat een database en een netwerk nodig heeft.
let package = Package(
	name: "BlaadjeSync",
	platforms: [.iOS(.v17), .macOS(.v14)],
	products: [
		.library(name: "BlaadjeSync", targets: ["BlaadjeSync"])
	],
	dependencies: [
		.package(path: "../BlaadjeKern"),
		.package(url: "https://github.com/powersync-ja/powersync-swift.git", from: "1.14.0"),
	],
	targets: [
		.target(
			name: "BlaadjeSync",
			dependencies: ["BlaadjeKern", .product(name: "PowerSync", package: "powersync-swift")]
		),
		.testTarget(name: "BlaadjeSyncTests", dependencies: ["BlaadjeSync", "BlaadjeKern"]),
	]
)
