/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  let baum: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    baum = ReactTestRenderer.create(<App />);
  });

  // Wieder abhaengen, SOLANGE der Lauf laeuft. Der Splash haelt eine ~2200 ms
  // lange Animated.sequence; der Aufrufer laesst ihn bis `onFertig` stehen.
  // Ohne Unmount ueberlebt ihr Timer das Ende der Suite und greift auf eine
  // bereits abgebaute Jest-Umgebung zu: erst "You are trying to `import` a
  // file after the Jest environment has been torn down", dann
  // `getNativeTagFromPublicInstance is not a function` aus dem nativen
  // Animationspfad. Jest meldete daraufhin 22 gruene Suiten UND Exitcode 1 —
  // gruen und rot zugleich, ohne einen Testnamen dazu (16.09.2026).
  //
  // Es ist ein WETTLAUF, kein deterministischer Fehler: auf einem schnellen
  // Rechner ist der Prozess vor dem Timer fertig und der Lauf wird gruen. Wer
  // das hier lokal prueft und Exit 0 sieht, hat damit nichts widerlegt — der
  // Beweis steht im CI-Log des Runners. Der Unmount laesst den
  // `lauf.stop()`-Aufraeumer der Komponente greifen und beendet die Bewegung,
  // statt sie nur unbeobachtet weiterlaufen zu lassen.
  await ReactTestRenderer.act(() => {
    baum?.unmount();
  });
});
