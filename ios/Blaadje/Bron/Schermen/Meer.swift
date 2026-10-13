import BlaadjeKern
import SwiftUI
import UniformTypeIdentifiers

/// Teamnaam, en je gegevens erin of eruit.
struct Meer: View {
    @Environment(AppModel.self) private var app
    @State private var teamnaam = ""
    @State private var code = ""
    @State private var bestandKiezen = false
    @State private var uitkomst: String?
    @State private var fout: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Team") {
                    TextField("Teamnaam", text: $teamnaam)
                        .submitLabel(.done)
                        // Bij elke letter bewaren: je tikt daarna zo naar een ander scherm.
                        .onChange(of: teamnaam) { _, nieuw in
                            if nieuw != app.toestand.teamName { app.zetTeamnaam(nieuw) }
                        }
                }
                Section {
                    Button { bestandKiezen = true } label: { Label("Kies een back-up", systemImage: "doc") }
                    TextField("Of plak hier een overzetcode", text: $code, axis: .vertical)
                        .lineLimit(1...4)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    if !code.isEmpty {
                        Button("Lees de code in") {
                            Toetsenbord.weg()
                            leesIn(code)
                            code = ""
                        }
                    }
                } header: {
                    Text("Overzetten van blaadje.app")
                } footer: {
                    Text("Maak op blaadje.app bij Meer een back-up of een code. Selectie, trainingen en bewaarde wedstrijden komen mee; wat hier al stond wordt vervangen.")
                }
                Section {
                    ShareLink(item: app.maakBackup(), preview: SharePreview("Back-up van Blaadje")) {
                        Label("Maak een back-up", systemImage: "square.and.arrow.up")
                    }
                } footer: {
                    Text("Alles staat alleen op dit toestel. Bewaar af en toe een back-up, bijvoorbeeld in Bestanden.")
                }
            }
            .toetsenbordWeg()
            .navigationTitle("Meer")
            .onAppear { teamnaam = app.toestand.teamName }
            .fileImporter(isPresented: $bestandKiezen, allowedContentTypes: [.json, .plainText]) { resultaat in
                guard case .success(let url) = resultaat else { return }
                let mag = url.startAccessingSecurityScopedResource()
                defer { if mag { url.stopAccessingSecurityScopedResource() } }
                guard let tekst = try? String(contentsOf: url, encoding: .utf8) else {
                    fout = "Dat bestand is niet te lezen."
                    return
                }
                leesIn(tekst)
            }
            .alert("Ingelezen", isPresented: Binding(get: { uitkomst != nil }, set: { if !$0 { uitkomst = nil } })) {
                Button("Oké") { uitkomst = nil }
            } message: { Text(uitkomst ?? "") }
            .alert("Dat lukte niet", isPresented: Binding(get: { fout != nil }, set: { if !$0 { fout = nil } })) {
                Button("Oké") { fout = nil }
            } message: { Text(fout ?? "") }
        }
    }

    private func leesIn(_ tekst: String) {
        do {
            uitkomst = try app.leesIn(tekst)
            teamnaam = app.toestand.teamName
        } catch {
            fout = "Dit is geen back-up of code van Blaadje."
        }
    }
}
