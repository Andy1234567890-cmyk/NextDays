// App-Konfiguration (bare React Native hat keine eingebauten Env-Vars wie Expo).
// Basis-URL des FastAPI-Backends. Im iOS-Simulator erreicht localhost den Host;
// auf einem echten Gerät die LAN-IP des Dev-Rechners eintragen.
import { Platform } from "react-native";

// Android-Emulator erreicht den Host über 10.0.2.2 statt localhost.
const DEFAULT_HOST = Platform.OS === "android" ? "10.0.2.2" : "localhost";

export const API_URL = `http://${DEFAULT_HOST}:8000`;
