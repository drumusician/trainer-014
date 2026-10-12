/**
 * A dictionary that remembers the order its keys arrived in, like a JavaScript
 * object does.
 *
 * That order is not decoration in the web app: playing time is wound back by
 * walking the lineup position by position, and "35 min K · 35 min LV" keeps the
 * order in which someone stood there. A plain Swift dictionary would shuffle
 * that on every run.
 *
 * Assigning to an existing key keeps its place; a new key goes to the end;
 * assigning nil removes it.
 */
public struct OrderedDict<Value> {
	public private(set) var keys: [String]
	private var opslag: [String: Value]

	public init() {
		keys = []
		opslag = [:]
	}

	/** Later duplicates overwrite the value but keep the first position, as in JavaScript. */
	public init(_ paren: [(String, Value)]) {
		self.init()
		for (k, v) in paren { self[k] = v }
	}

	public subscript(key: String) -> Value? {
		get { opslag[key] }
		set {
			if let newValue {
				if opslag.updateValue(newValue, forKey: key) == nil { keys.append(key) }
			} else if opslag.removeValue(forKey: key) != nil {
				keys.removeAll { $0 == key }
			}
		}
	}

	public subscript(key: String, default standaard: @autoclosure () -> Value) -> Value {
		get { opslag[key] ?? standaard() }
		set { self[key] = newValue }
	}

	public var count: Int { keys.count }
	public var isEmpty: Bool { keys.isEmpty }
	public func contains(_ key: String) -> Bool { opslag[key] != nil }

	/** Object.values */
	public var values: [Value] { keys.map { opslag[$0]! } }

	/** Object.entries */
	public var entries: [(key: String, value: Value)] { keys.map { (key: $0, value: opslag[$0]!) } }

	/** Without the order, for when only the content matters. */
	public var dictionary: [String: Value] { opslag }

	@discardableResult
	public mutating func removeValue(forKey key: String) -> Value? {
		let oud = opslag[key]
		self[key] = nil
		return oud
	}

	public func mapValues<T>(_ f: (Value) throws -> T) rethrows -> OrderedDict<T> {
		var uit = OrderedDict<T>()
		for k in keys { uit[k] = try f(opslag[k]!) }
		return uit
	}
}

extension OrderedDict: ExpressibleByDictionaryLiteral {
	public init(dictionaryLiteral elements: (String, Value)...) {
		self.init(elements)
	}
}

/** Equal means: the same keys, the same values, in the same order. */
extension OrderedDict: Equatable where Value: Equatable {
	public static func == (a: OrderedDict, b: OrderedDict) -> Bool {
		a.keys == b.keys && a.opslag == b.opslag
	}
}

extension OrderedDict: Sendable where Value: Sendable {}
