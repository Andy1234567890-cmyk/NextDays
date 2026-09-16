package com.mynextdays.app

import android.os.Bundle

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory

class MainActivity : ReactActivity() {

  /**
   * Android stellt beim Neustart eines getoeteten Prozesses die gespeicherten
   * Fragmente per Reflexion ueber ihren parameterlosen Konstruktor wieder her.
   * Genau den wirft `ScreenFragment` absichtlich weg ("Screen fragments should
   * never be restored") — die App stirbt dann in `performLaunchActivity`, also
   * BEVOR eine Zeile JS laeuft. Fuer den Nutzer ist das ein Absturz direkt beim
   * Oeffnen, durch normales Bedienen nicht reproduzierbar (Play-Console,
   * Galaxy A54 / Android 16, 1.0.0+16).
   *
   * Die Factory liefert stattdessen ein `AutoRemovingFragment`, das sich sofort
   * selbst aushaengt; React baut die Screens danach neu auf. Sie MUSS vor
   * `super.onCreate` stehen — der Restore laeuft innerhalb von `super.onCreate`
   * (ComponentActivity → FragmentManager.attachController).
   *
   * Das Bundle wird bewusst DURCHGEREICHT statt `null` (der aeltere Ratschlag):
   * so bleibt die ActivityResultRegistry erhalten, an der Kamera- und
   * Dateiauswahl haengen.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()
    super.onCreate(savedInstanceState)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "MyNextDays"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
