import SwiftUI

struct ContentView: View {
    @State private var count = 0

    var body: some View {
        VStack(spacing: 16) {
            Text(greeting(count: count))
                .font(.title)
            Button("Tap") { count += 1 }
                .buttonStyle(.borderedProminent)
        }
        .padding()
    }
}

func greeting(count: Int) -> String {
    count == 0 ? "Hello" : "Tapped \(count) times"
}

#Preview {
    ContentView()
}
