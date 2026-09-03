package com.mynextdays.owner

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    meldungsKanalAnlegen()
  }

  /**
   * Der Benachrichtigungs-Kanal fuer Push (ab Android 8 Pflicht).
   *
   * Er wird HIER angelegt, nicht in JS: kommt eine Meldung bei geschlossener
   * App an, zeigt sie das System selbst — ohne dass JS je lief. Waere der Kanal
   * erst in JS erzeugt, verwarfe Android genau die wichtigsten Meldungen still.
   * Die ID muss zu `firebase.json`
   * (`messaging_android_notification_channel_id`) passen.
   *
   * `createNotificationChannel` ist idempotent: ein zweiter Aufruf mit
   * derselben ID aendert nichts, und vom Nutzer geaenderte Einstellungen
   * (Ton, Wichtigkeit) bleiben erhalten.
   */
  private fun meldungsKanalAnlegen() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val kanal = NotificationChannel(
      "nextdays_wichtig",
      // Der Name steht in den Android-Systemeinstellungen. Deutsch wie die
      // restliche App (kein i18n in dieser App, s. HostInbox).
      "Buchungen und Nachrichten",
      // HIGH = mit Ton und als Einblendung. Eine neue Buchung oder Gastfrage
      // ist der Grund, warum jemand diese App auf dem Telefon hat.
      NotificationManager.IMPORTANCE_HIGH,
    )
    kanal.description = "Neue Buchungen und neue Gastnachrichten"
    val manager = getSystemService(NotificationManager::class.java)
    manager?.createNotificationChannel(kanal)
  }
}
