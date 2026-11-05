import Testing
@testable import Main

struct GreetingTests {
    @Test func startsWithHello() {
        #expect(greeting(count: 0) == "Hello")
    }

    @Test func countsTaps() {
        #expect(greeting(count: 3) == "Tapped 3 times")
    }
}
