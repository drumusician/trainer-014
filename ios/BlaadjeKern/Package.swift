// swift-tools-version: 5.9
import PackageDescription

let package = Package(
	name: "BlaadjeKern",
	platforms: [.iOS(.v17), .macOS(.v14)],
	products: [
		.library(name: "BlaadjeKern", targets: ["BlaadjeKern"])
	],
	targets: [
		.target(name: "BlaadjeKern"),
		.testTarget(
			name: "BlaadjeKernTests",
			dependencies: ["BlaadjeKern"],
			resources: [.copy("Fixtures")]
		)
	]
)
