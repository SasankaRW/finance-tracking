package com.cashly.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class AddTransactionWidgetProvider extends AppWidgetProvider {
    private static final String KIND_EXPENSE = "expense";
    private static final String KIND_INCOME = "income";
    private static final String KIND_TRANSFER = "transfer";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_add_transaction);

        views.setOnClickPendingIntent(
            R.id.widget_add_transaction_button,
            createQuickAddIntent(context, appWidgetId, KIND_EXPENSE, 0)
        );
        views.setOnClickPendingIntent(
            R.id.widget_expense_button,
            createQuickAddIntent(context, appWidgetId, KIND_EXPENSE, 1)
        );
        views.setOnClickPendingIntent(
            R.id.widget_income_button,
            createQuickAddIntent(context, appWidgetId, KIND_INCOME, 2)
        );
        views.setOnClickPendingIntent(
            R.id.widget_transfer_button,
            createQuickAddIntent(context, appWidgetId, KIND_TRANSFER, 3)
        );

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static PendingIntent createQuickAddIntent(
        Context context,
        int appWidgetId,
        String kind,
        int actionIndex
    ) {
        Intent intent = new Intent(context, QuickAddTransactionActivity.class);
        intent.putExtra(QuickAddTransactionActivity.EXTRA_KIND, kind);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        return PendingIntent.getActivity(
            context,
            appWidgetId * 10 + actionIndex,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}
