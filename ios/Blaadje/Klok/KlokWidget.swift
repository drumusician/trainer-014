import ActivityKit
import SwiftUI
import WidgetKit

@main
struct KlokBundel: WidgetBundle {
    var body: some Widget { KlokWidget() }
}

private let groen = Color(red: 0x2f / 255, green: 0x5d / 255, blue: 0x4a / 255)

/// De klok en de stand op het vergrendelscherm en in het eiland bovenin.
struct KlokWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: KlokGegevens.self) { context in
            Vergrendelscherm(s: context.state)
                .activityBackgroundTint(groen)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            let s = context.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text("\(s.standLinks) – \(s.standRechts)").font(.title.bold()).monospacedDigit().padding(.leading, 6)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Tijd(s: s).font(.title.bold()).padding(.trailing, 6)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text("\(s.links) – \(s.rechts)").lineLimit(1)
                        Spacer()
                        Text(s.deel)
                    }
                    .font(.footnote).foregroundStyle(.secondary).padding(.horizontal, 6)
                }
            } compactLeading: {
                Text("\(s.standLinks)–\(s.standRechts)").font(.subheadline.bold()).monospacedDigit()
            } compactTrailing: {
                Tijd(s: s).font(.subheadline.bold()).frame(maxWidth: 52)
            } minimal: {
                Tijd(s: s).font(.caption2.bold()).frame(maxWidth: 40)
            }
        }
    }
}

/// Loopt de klok, dan telt het systeem zelf; de app hoeft er niet voor wakker te zijn.
private struct Tijd: View {
    let s: KlokGegevens.ContentState

    var body: some View {
        Group {
            if s.loopt {
                Text(timerInterval: s.begin...Date.distantFuture, countsDown: false)
            } else {
                Text(String(format: "%02d:%02d", Int(s.verstreken) / 60, Int(s.verstreken) % 60))
            }
        }
        .monospacedDigit()
        .multilineTextAlignment(.trailing)
    }
}

private struct Vergrendelscherm: View {
    let s: KlokGegevens.ContentState

    var body: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
                Text("\(s.links) – \(s.rechts)").font(.subheadline).lineLimit(1).opacity(0.85)
                Text("\(s.standLinks) – \(s.standRechts)").font(.system(size: 38, weight: .bold)).monospacedDigit()
            }
            Spacer(minLength: 12)
            VStack(alignment: .trailing, spacing: 2) {
                Tijd(s: s).font(.system(size: 38, weight: .bold)).frame(maxWidth: 150, alignment: .trailing)
                Text(s.loopt ? s.deel : (s.deel.hasPrefix("Rust") || s.deel.hasPrefix("Pauze") ? s.deel : "\(s.deel) · klok staat stil"))
                    .font(.subheadline).opacity(0.85)
            }
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
    }
}
