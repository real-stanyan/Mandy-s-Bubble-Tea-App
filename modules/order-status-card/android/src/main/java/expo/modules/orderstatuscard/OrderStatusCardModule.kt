package expo.modules.orderstatuscard

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

// Android counterpart of the iOS Live Activity lock-screen card: one ongoing
// (non-swipeable) notification per active order, updated in place as the
// order advances, removed the moment it turns terminal — mirroring the iOS
// immediate-dismissal contract. On Android 16+ the same notification opts
// into Live Updates promotion (status-bar chip / lock-screen top slot /
// Samsung Now Bar) via ProgressStyle; older versions render the classic
// progress-bar ongoing notification.
//
// The JS layer owns all vocabulary (status → title/body/step); this module
// only draws. Notification id = orderId.hashCode() so upsert/cancel by
// orderId needs no persistence.

class CardParams : Record {
  @Field var title: String = ""
  @Field var body: String = ""
  /** Ticket label shown as subtext, e.g. "#OL802". */
  @Field var orderNumber: String? = null
  /** 0-based current step. */
  @Field var stepIndex: Int = 0
  /** Total steps (pickup 3, delivery 4). */
  @Field var stepCount: Int = 3
  /** false renders a dismissible final card instead of an ongoing one. */
  @Field var ongoing: Boolean = true
}

private const val CHANNEL_ID = "order-status"

class OrderStatusCardModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext)

  override fun definition() = ModuleDefinition {
    Name("OrderStatusCard")

    Function("upsert") { orderId: String, params: CardParams ->
      ensureChannel()
      notificationManager.notify(notificationId(orderId), build(orderId, params))
    }

    Function("cancel") { orderId: String ->
      notificationManager.cancel(notificationId(orderId))
    }
  }

  private val notificationManager: NotificationManager
    get() = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  private fun notificationId(orderId: String): Int = orderId.hashCode()

  private fun ensureChannel() {
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Order status",
      NotificationManager.IMPORTANCE_DEFAULT,
    ).apply {
      description = "Live progress of your current order"
      setShowBadge(false)
    }
    notificationManager.createNotificationChannel(channel)
  }

  private fun build(orderId: String, params: CardParams): Notification {
    val maxProgress = (params.stepCount - 1).coerceAtLeast(1)
    val progress = params.stepIndex.coerceIn(0, maxProgress)

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(smallIconRes())
      .setContentTitle(params.title)
      .setContentText(params.body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(params.body))
      .setColor(BRAND_COLOR)
      .setOngoing(params.ongoing)
      .setAutoCancel(!params.ongoing)
      .setOnlyAlertOnce(true)
      .setContentIntent(contentIntent(orderId))
      .setProgress(maxProgress, progress, false)
      .setCategory(NotificationCompat.CATEGORY_PROGRESS)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)

    params.orderNumber?.takeIf { it.isNotBlank() }?.let { builder.setSubText(it) }

    if (Build.VERSION.SDK_INT >= 36 && params.ongoing) {
      return promoteToLiveUpdate(builder.build(), params, progress, maxProgress)
    }
    return builder.build()
  }

  /** Android 16 Live Updates: rebuild with ProgressStyle + promotion request.
   *  Recovered notification falls back to the compat build on any failure —
   *  OEM skins have been flaky about the new APIs in early 16 releases. */
  private fun promoteToLiveUpdate(
    fallback: Notification,
    params: CardParams,
    progress: Int,
    maxProgress: Int,
  ): Notification {
    return try {
      val segment = Notification.ProgressStyle.Segment(1)
        .setColor(BRAND_COLOR)
      val style = Notification.ProgressStyle()
        .setProgressSegments(List(maxProgress) { segment })
        .setProgress(progress)
      Notification.Builder.recoverBuilder(context, fallback)
        .setStyle(style)
        .setShortCriticalText(params.orderNumber ?: "")
        .build()
    } catch (t: Throwable) {
      fallback
    }
  }

  private fun contentIntent(orderId: String): PendingIntent {
    val intent = Intent(
      Intent.ACTION_VIEW,
      Uri.parse("mandysbubbleteaapp://order-detail?orderId=$orderId"),
    ).apply {
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    return PendingIntent.getActivity(
      context,
      notificationId(orderId),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  /** expo-notifications generates notification_icon when configured; fall
   *  back to the app icon (rendered as a silhouette) otherwise. */
  private fun smallIconRes(): Int {
    val custom = context.resources.getIdentifier(
      "notification_icon", "drawable", context.packageName,
    )
    return if (custom != 0) custom else context.applicationInfo.icon
  }

  private companion object {
    const val BRAND_COLOR = 0xFFC43A10.toInt()
  }
}
