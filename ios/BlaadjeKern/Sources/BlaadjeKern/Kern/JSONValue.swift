import Foundation

/**
 * JSON as a value, with the keys of an object in the order they were written.
 *
 * Two reasons this exists instead of leaning on JSONDecoder alone. Older storage
 * is converted by walking the whole tree (see MigrateStorage.swift), which needs
 * a tree. And JSONDecoder hands back object keys in no particular order, while
 * the order of a lineup is something the calculations depend on.
 */
public enum JSONValue: Sendable {
	case null
	case bool(Bool)
	case number(Double)
	case string(String)
	case array([JSONValue])
	case object(OrderedDict<JSONValue>)
}

public enum JSONFout: Error, Equatable, CustomStringConvertible {
	case onleesbaar(String)

	public var description: String {
		switch self {
		case .onleesbaar(let wat): return "geen geldige JSON: " + wat
		}
	}
}

/* Two objects are equal when they hold the same keys and values; the order of
   the keys is not part of what JSON means. */
extension JSONValue: Equatable {
	public static func == (a: JSONValue, b: JSONValue) -> Bool {
		switch (a, b) {
		case (.null, .null): return true
		case (.bool(let x), .bool(let y)): return x == y
		case (.number(let x), .number(let y)): return x == y
		case (.string(let x), .string(let y)): return x == y
		case (.array(let x), .array(let y)): return x == y
		case (.object(let x), .object(let y)): return x.dictionary == y.dictionary
		default: return false
		}
	}
}

/* ---------- reading the value ---------- */

public extension JSONValue {
	var objectValue: OrderedDict<JSONValue>? {
		if case .object(let o) = self { return o }
		return nil
	}

	var arrayValue: [JSONValue]? {
		if case .array(let a) = self { return a }
		return nil
	}

	var stringValue: String? {
		if case .string(let s) = self { return s }
		return nil
	}

	var numberValue: Double? {
		if case .number(let n) = self { return n }
		return nil
	}

	var boolValue: Bool? {
		if case .bool(let b) = self { return b }
		return nil
	}

	var isNull: Bool {
		if case .null = self { return true }
		return false
	}

	/** A field of an object; nil when this is not an object or the field is absent. */
	subscript(key: String) -> JSONValue? {
		objectValue?[key]
	}

	/** What `if (x)` would say in JavaScript. */
	internal var truthy: Bool {
		switch self {
		case .null: return false
		case .bool(let b): return b
		case .number(let n): return n != 0 && !n.isNaN
		case .string(let s): return !s.isEmpty
		case .array, .object: return true
		}
	}
}

/* ---------- JSON.parse ---------- */

public extension JSONValue {
	static func parse(_ tekst: String) throws -> JSONValue {
		var lezer = Lezer(bytes: Array(tekst.utf8))
		lezer.witruimte()
		let waarde = try lezer.waarde()
		lezer.witruimte()
		guard lezer.i == lezer.bytes.count else { throw JSONFout.onleesbaar("er staat nog iets achter") }
		return waarde
	}
}

private struct Lezer {
	let bytes: [UInt8]
	var i = 0

	init(bytes: [UInt8]) { self.bytes = bytes }

	var huidig: UInt8? { i < bytes.count ? bytes[i] : nil }

	mutating func witruimte() {
		while let b = huidig, b == 0x20 || b == 0x09 || b == 0x0A || b == 0x0D { i += 1 }
	}

	mutating func waarde() throws -> JSONValue {
		guard let b = huidig else { throw JSONFout.onleesbaar("onverwacht einde") }
		switch b {
		case UInt8(ascii: "{"): return try object()
		case UInt8(ascii: "["): return try lijst()
		case UInt8(ascii: "\""): return .string(try tekst())
		case UInt8(ascii: "t"): try woord("true"); return .bool(true)
		case UInt8(ascii: "f"): try woord("false"); return .bool(false)
		case UInt8(ascii: "n"): try woord("null"); return .null
		default: return .number(try getal())
		}
	}

	mutating func woord(_ w: String) throws {
		let verwacht = Array(w.utf8)
		guard i + verwacht.count <= bytes.count, Array(bytes[i..<i + verwacht.count]) == verwacht else {
			throw JSONFout.onleesbaar("onbekend woord op positie \(i)")
		}
		i += verwacht.count
	}

	mutating func getal() throws -> Double {
		let begin = i
		func cijfer(_ b: UInt8?) -> Bool { b.map { $0 >= 0x30 && $0 <= 0x39 } ?? false }
		if huidig == UInt8(ascii: "-") { i += 1 }
		guard cijfer(huidig) else { throw JSONFout.onleesbaar("onverwacht teken op positie \(i)") }
		if huidig == UInt8(ascii: "0") {
			i += 1
		} else {
			while cijfer(huidig) { i += 1 }
		}
		if huidig == UInt8(ascii: ".") {
			i += 1
			guard cijfer(huidig) else { throw JSONFout.onleesbaar("getal breekt af op positie \(i)") }
			while cijfer(huidig) { i += 1 }
		}
		if huidig == UInt8(ascii: "e") || huidig == UInt8(ascii: "E") {
			i += 1
			if huidig == UInt8(ascii: "+") || huidig == UInt8(ascii: "-") { i += 1 }
			guard cijfer(huidig) else { throw JSONFout.onleesbaar("getal breekt af op positie \(i)") }
			while cijfer(huidig) { i += 1 }
		}
		guard let d = Double(String(decoding: bytes[begin..<i], as: UTF8.self)) else {
			throw JSONFout.onleesbaar("geen getal op positie \(begin)")
		}
		return d
	}

	mutating func hex4() throws -> UInt16 {
		guard i + 4 <= bytes.count,
			let v = UInt16(String(decoding: bytes[i..<i + 4], as: UTF8.self), radix: 16)
		else { throw JSONFout.onleesbaar("kapotte \\u op positie \(i)") }
		i += 4
		return v
	}

	mutating func tekst() throws -> String {
		i += 1 /* the opening quote */
		var uit: [UInt8] = []
		while true {
			guard let b = huidig else { throw JSONFout.onleesbaar("tekst zonder einde") }
			i += 1
			if b == UInt8(ascii: "\"") { break }
			if b < 0x20 { throw JSONFout.onleesbaar("stuurteken in tekst op positie \(i - 1)") }
			if b != UInt8(ascii: "\\") {
				uit.append(b)
				continue
			}
			guard let e = huidig else { throw JSONFout.onleesbaar("tekst zonder einde") }
			i += 1
			switch e {
			case UInt8(ascii: "\""): uit.append(0x22)
			case UInt8(ascii: "\\"): uit.append(0x5C)
			case UInt8(ascii: "/"): uit.append(0x2F)
			case UInt8(ascii: "b"): uit.append(0x08)
			case UInt8(ascii: "f"): uit.append(0x0C)
			case UInt8(ascii: "n"): uit.append(0x0A)
			case UInt8(ascii: "r"): uit.append(0x0D)
			case UInt8(ascii: "t"): uit.append(0x09)
			case UInt8(ascii: "u"):
				var eenheden = [try hex4()]
				/* a pair of surrogates is one character */
				if eenheden[0] >= 0xD800, eenheden[0] < 0xDC00,
					i + 1 < bytes.count, bytes[i] == UInt8(ascii: "\\"), bytes[i + 1] == UInt8(ascii: "u")
				{
					let terug = i
					i += 2
					let tweede = try hex4()
					if tweede >= 0xDC00, tweede < 0xE000 {
						eenheden.append(tweede)
					} else {
						i = terug
					}
				}
				uit.append(contentsOf: Array(String(decoding: eenheden, as: UTF16.self).utf8))
			default: throw JSONFout.onleesbaar("onbekende escape op positie \(i - 1)")
			}
		}
		return String(decoding: uit, as: UTF8.self)
	}

	mutating func lijst() throws -> JSONValue {
		i += 1
		var uit: [JSONValue] = []
		witruimte()
		if huidig == UInt8(ascii: "]") {
			i += 1
			return .array(uit)
		}
		while true {
			witruimte()
			uit.append(try waarde())
			witruimte()
			guard let b = huidig else { throw JSONFout.onleesbaar("lijst zonder einde") }
			i += 1
			if b == UInt8(ascii: "]") { return .array(uit) }
			if b != UInt8(ascii: ",") { throw JSONFout.onleesbaar("onverwacht teken op positie \(i - 1)") }
		}
	}

	mutating func object() throws -> JSONValue {
		i += 1
		var uit = OrderedDict<JSONValue>()
		witruimte()
		if huidig == UInt8(ascii: "}") {
			i += 1
			return .object(uit)
		}
		while true {
			witruimte()
			guard huidig == UInt8(ascii: "\"") else { throw JSONFout.onleesbaar("sleutel verwacht op positie \(i)") }
			let sleutel = try tekst()
			witruimte()
			guard huidig == UInt8(ascii: ":") else { throw JSONFout.onleesbaar("dubbele punt verwacht op positie \(i)") }
			i += 1
			witruimte()
			uit[sleutel] = try waarde()
			witruimte()
			guard let b = huidig else { throw JSONFout.onleesbaar("object zonder einde") }
			i += 1
			if b == UInt8(ascii: "}") { return .object(uit) }
			if b != UInt8(ascii: ",") { throw JSONFout.onleesbaar("onverwacht teken op positie \(i - 1)") }
		}
	}
}

/* ---------- JSON.stringify ---------- */

public extension JSONValue {
	/**
	 * The value as text, the way JSON.stringify writes it: compact without
	 * `inspringing`, or one field per line with that many spaces.
	 */
	func tekst(inspringing: Int = 0) -> String {
		var uit = ""
		schrijf(naar: &uit, inspringing: inspringing, diepte: 0)
		return uit
	}

	private func schrijf(naar uit: inout String, inspringing: Int, diepte: Int) {
		func regel(_ d: Int) {
			guard inspringing > 0 else { return }
			uit += "\n" + String(repeating: " ", count: inspringing * d)
		}
		switch self {
		case .null: uit += "null"
		case .bool(let b): uit += b ? "true" : "false"
		case .number(let n): uit += n.isFinite ? jsGetal(n == 0 ? 0 : n) : "null"
		case .string(let s): JSONValue.schrijfTekst(s, naar: &uit)
		case .array(let a):
			if a.isEmpty {
				uit += "[]"
				return
			}
			uit += "["
			for (n, x) in a.enumerated() {
				if n > 0 { uit += "," }
				regel(diepte + 1)
				x.schrijf(naar: &uit, inspringing: inspringing, diepte: diepte + 1)
			}
			regel(diepte)
			uit += "]"
		case .object(let o):
			if o.isEmpty {
				uit += "{}"
				return
			}
			uit += "{"
			for (n, paar) in o.entries.enumerated() {
				if n > 0 { uit += "," }
				regel(diepte + 1)
				JSONValue.schrijfTekst(paar.key, naar: &uit)
				uit += inspringing > 0 ? ": " : ":"
				paar.value.schrijf(naar: &uit, inspringing: inspringing, diepte: diepte + 1)
			}
			regel(diepte)
			uit += "}"
		}
	}

	private static func schrijfTekst(_ s: String, naar uit: inout String) {
		uit += "\""
		for u in s.unicodeScalars {
			switch u {
			case "\"": uit += "\\\""
			case "\\": uit += "\\\\"
			case "\u{08}": uit += "\\b"
			case "\u{0C}": uit += "\\f"
			case "\n": uit += "\\n"
			case "\r": uit += "\\r"
			case "\t": uit += "\\t"
			default:
				if u.value < 0x20 {
					uit += "\\u" + String(format: "%04x", u.value)
				} else {
					uit.unicodeScalars.append(u)
				}
			}
		}
		uit += "\""
	}
}

/* ---------- Codable, for use with JSONEncoder and JSONDecoder ---------- */

private struct Sleutel: CodingKey {
	var stringValue: String
	var intValue: Int? { nil }
	init(_ s: String) { stringValue = s }
	init?(stringValue: String) { self.stringValue = stringValue }
	init?(intValue: Int) { return nil }
}

extension JSONValue: Codable {
	/* Through JSONDecoder the keys of an object arrive in whatever order it
	   likes. Where the order matters, read with JSONValue.parse instead. */
	public init(from decoder: Decoder) throws {
		if let c = try? decoder.container(keyedBy: Sleutel.self) {
			var o = OrderedDict<JSONValue>()
			for k in c.allKeys { o[k.stringValue] = try c.decode(JSONValue.self, forKey: k) }
			self = .object(o)
			return
		}
		if var c = try? decoder.unkeyedContainer() {
			var a: [JSONValue] = []
			while !c.isAtEnd { a.append(try c.decode(JSONValue.self)) }
			self = .array(a)
			return
		}
		let c = try decoder.singleValueContainer()
		if c.decodeNil() {
			self = .null
		} else if let b = try? c.decode(Bool.self) {
			self = .bool(b)
		} else if let n = try? c.decode(Double.self) {
			self = .number(n)
		} else {
			self = .string(try c.decode(String.self))
		}
	}

	public func encode(to encoder: Encoder) throws {
		switch self {
		case .null:
			var c = encoder.singleValueContainer()
			try c.encodeNil()
		case .bool(let b):
			var c = encoder.singleValueContainer()
			try c.encode(b)
		case .number(let n):
			var c = encoder.singleValueContainer()
			if n == n.rounded(), abs(n) < 9e15 {
				try c.encode(Int64(n))
			} else {
				try c.encode(n)
			}
		case .string(let s):
			var c = encoder.singleValueContainer()
			try c.encode(s)
		case .array(let a):
			var c = encoder.unkeyedContainer()
			for x in a { try c.encode(x) }
		case .object(let o):
			var c = encoder.container(keyedBy: Sleutel.self)
			for (k, v) in o.entries { try c.encode(v, forKey: Sleutel(k)) }
		}
	}
}

/* ---------- models ---------- */

/**
 * A model that reads and writes exactly the JSON the web app stores.
 *
 * Every model spells out its own `init(json:)` and `json`, because the stored
 * shape has rules Codable cannot express on its own: a score is a pair in a
 * list, a goal without a known scorer says `"player": null` while a
 * substitution has no such field at all, and older files miss fields that
 * newer code expects. Codable comes for free on top of that.
 *
 * Reading is forgiving, as the web app is: a missing field gets the value the
 * code would otherwise fall back on (`a.events ?? []`), it does not fail.
 */
public protocol JSONModel: Codable {
	init(json: JSONValue) throws
	var json: JSONValue { get }
}

public extension JSONModel {
	init(from decoder: Decoder) throws {
		try self.init(json: JSONValue(from: decoder))
	}

	func encode(to encoder: Encoder) throws {
		try json.encode(to: encoder)
	}

	/** Reads text, keeping the order of object keys. Prefer this over JSONDecoder. */
	init(jsonTekst: String) throws {
		try self.init(json: JSONValue.parse(jsonTekst))
	}

	/** JSON.stringify(model), or with `inspringing: 2` the readable form. */
	func jsonTekst(inspringing: Int = 0) -> String {
		json.tekst(inspringing: inspringing)
	}
}

public enum BlaadjeFout: Error, Equatable, CustomStringConvertible {
	/** a back-up or code without a squad in it */
	case geenSelectie
	/** where an object was expected, there was something else */
	case geenObject(String)
	/** an event of a kind this version does not know */
	case onbekendeGebeurtenis(String)
	/** a transfer code that is not base64 */
	case ongeldigeCode

	public var description: String {
		switch self {
		case .geenSelectie: return "hier staat geen selectie in"
		case .geenObject(let wat): return "geen object: " + wat
		case .onbekendeGebeurtenis(let soort): return "onbekende gebeurtenis: " + soort
		case .ongeldigeCode: return "dit is geen geldige code"
		}
	}
}

/* Reading fields out of an object, forgivingly: the wrong type counts as absent. */
extension OrderedDict where Value == JSONValue {
	func str(_ k: String) -> String? { self[k]?.stringValue }
	func num(_ k: String) -> Double? { self[k]?.numberValue }
	func bool(_ k: String) -> Bool? { self[k]?.boolValue }
	func arr(_ k: String) -> [JSONValue]? { self[k]?.arrayValue }

	func int(_ k: String) -> Int? {
		guard let n = num(k), n.isFinite, abs(n) < 9e15 else { return nil }
		return Int(jsRound(n))
	}

	func strings(_ k: String) -> [String]? {
		arr(k)?.compactMap(\.stringValue)
	}

	func obj(_ k: String) -> JSONValue? {
		guard let v = self[k], v.objectValue != nil else { return nil }
		return v
	}

	mutating func zet(_ k: String, _ s: String?) {
		if let s { self[k] = .string(s) }
	}

	mutating func zet(_ k: String, _ n: Double?) {
		if let n { self[k] = .number(n) }
	}

	mutating func zet(_ k: String, _ n: Int?) {
		if let n { self[k] = .number(Double(n)) }
	}

	mutating func zet(_ k: String, _ b: Bool?) {
		if let b { self[k] = .bool(b) }
	}

	mutating func zet(_ k: String, _ lijst: [String]?) {
		if let lijst { self[k] = .array(lijst.map(JSONValue.string)) }
	}
}

func alsObject(_ json: JSONValue, _ wat: String) throws -> OrderedDict<JSONValue> {
	guard let o = json.objectValue else { throw BlaadjeFout.geenObject(wat) }
	return o
}

func nullOf(_ s: String?) -> JSONValue {
	s.map(JSONValue.string) ?? .null
}
