// Zahlung im PaymentSheet — geprüft wird die EINE Frage: wann darf die App
// „bezahlt" sagen?
//
// Der Anlass (19.08.2026): Vorher meldete der Checkout „Buchung bestätigt",
// ohne dass jemals gezahlt wurde. Die Umkehrung darf nicht dasselbe von der
// anderen Seite werden — ein Abbruch oder ein Fehler des SDK muss als solcher
// herauskommen, nie als Erfolg (fail-closed).
export {};

// Namen mit `mock`-Präfix: nur die darf eine jest.mock-Fabrik von außen sehen.
type Antwort = { error?: { code?: string; message: string } };
const mockInitStripe = jest.fn(
  async (_params: Record<string, unknown>): Promise<void> => undefined,
);
const mockInitPaymentSheet = jest.fn(
  async (_params: Record<string, unknown>): Promise<Antwort> => ({}),
);
const mockPresentPaymentSheet = jest.fn(async (): Promise<Antwort> => ({}));

jest.mock("@stripe/stripe-react-native", () => ({
  initStripe: mockInitStripe,
  initPaymentSheet: mockInitPaymentSheet,
  presentPaymentSheet: mockPresentPaymentSheet,
}));

type Modul = typeof import("../zahlung");
const { zahleBuchung }: Modul = require("../zahlung");

const EINGABE = {
  clientSecret: "pi_123_secret_456",
  publishableKey: "pk_test_abc",
  name: "Ida Iversen",
  email: "ida@example.com",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockInitPaymentSheet.mockResolvedValue({});
  mockPresentPaymentSheet.mockResolvedValue({});
});

describe("zahleBuchung", () => {
  it("meldet bezahlt, wenn das Sheet ohne Fehler schließt", async () => {
    await expect(zahleBuchung(EINGABE)).resolves.toEqual({ art: "bezahlt" });
  });

  it("nutzt den Schlüssel aus der Server-Antwort und KEIN Verbundkonto", async () => {
    await zahleBuchung(EINGABE);
    const params = mockInitStripe.mock.calls[0][0];
    expect(params.publishableKey).toBe("pk_test_abc");
    // Marktplatz-Intents liegen im Plattformkonto (`direct=False`). Mit
    // gesetztem stripeAccountId antwortet Stripe „No such payment_intent".
    expect(params.stripeAccountId).toBeUndefined();
    expect(params.urlScheme).toBe("mybestdays");
  });

  it("gibt dem Sheet den Rückweg für 3-D Secure mit", async () => {
    await zahleBuchung(EINGABE);
    const params = mockInitPaymentSheet.mock.calls[0][0];
    expect(params.returnURL).toBe("mybestdays://stripe-redirect");
    expect(params.paymentIntentClientSecret).toBe("pi_123_secret_456");
    // Verzögerte Methoden aus: sonst gälte eine Buchung als bezahlt, deren
    // Zahlung erst Tage später gelingt oder scheitert.
    expect(params.allowsDelayedPaymentMethods).toBe(false);
  });

  it("wertet einen Abbruch NICHT als Fehler und NICHT als Zahlung", async () => {
    mockPresentPaymentSheet.mockResolvedValue({
      error: { code: "Canceled", message: "abgebrochen" },
    });
    await expect(zahleBuchung(EINGABE)).resolves.toEqual({ art: "abgebrochen" });
  });

  it("gibt einen echten Sheet-Fehler durch", async () => {
    mockPresentPaymentSheet.mockResolvedValue({
      error: { code: "Failed", message: "Karte abgelehnt" },
    });
    await expect(zahleBuchung(EINGABE)).resolves.toEqual({
      art: "fehler",
      meldung: "Karte abgelehnt",
    });
  });

  it("scheitert klar, wenn das Sheet nicht vorbereitet werden kann", async () => {
    mockInitPaymentSheet.mockResolvedValue({ error: { message: "Intent unbekannt" } });
    await expect(zahleBuchung(EINGABE)).resolves.toEqual({
      art: "fehler",
      meldung: "Intent unbekannt",
    });
    // Ohne Vorbereitung wird das Sheet gar nicht gezeigt.
    expect(mockPresentPaymentSheet).not.toHaveBeenCalled();
  });

  it("fängt einen nativen Absturz ab, statt ihn als Erfolg zu werten", async () => {
    mockInitStripe.mockRejectedValueOnce(new Error("StripeSdk fehlt"));
    await expect(zahleBuchung(EINGABE)).resolves.toEqual({
      art: "fehler",
      meldung: "StripeSdk fehlt",
    });
  });
});
