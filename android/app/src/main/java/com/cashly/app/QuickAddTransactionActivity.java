package com.cashly.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class QuickAddTransactionActivity extends Activity {
    public static final String EXTRA_KIND = "cashly_kind";

    private static final String KIND_EXPENSE = "expense";
    private static final String KIND_INCOME = "income";
    private static final String KIND_TRANSFER = "transfer";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private WidgetSessionStore store;
    private WidgetSessionStore.WidgetSession session;
    private String kind = KIND_EXPENSE;

    private LinearLayout formFields;
    private Button expenseButton;
    private Button incomeButton;
    private Button transferButton;
    private EditText amountInput;
    private EditText noteInput;
    private Spinner accountSpinner;
    private Spinner categorySpinner;
    private Spinner fromAccountSpinner;
    private Spinner toAccountSpinner;
    private Button saveButton;
    private ProgressBar progressBar;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        store = new WidgetSessionStore(this);
        kind = normalizeKind(getIntent().getStringExtra(EXTRA_KIND));

        try {
            session = store.read();
        } catch (Exception e) {
            session = null;
        }

        if (session == null || !session.isFresh()) {
            showRefreshRequired();
            return;
        }

        showQuickAddForm();
    }

    @Override
    protected void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }

    private void showRefreshRequired() {
        LinearLayout root = rootLayout();

        TextView title = title("Refresh widget access");
        TextView message = bodyText("Open Cashly once while signed in, then try the widget again.");

        Button openApp = primaryButton("Open Cashly");
        openApp.setOnClickListener(v -> {
            Intent intent = new Intent(this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(intent);
            finish();
        });

        Button cancel = secondaryButton("Cancel");
        cancel.setOnClickListener(v -> finish());

        root.addView(title);
        root.addView(message);
        root.addView(openApp);
        root.addView(cancel);
        setContentView(root);
    }

    private void showQuickAddForm() {
        LinearLayout root = rootLayout();
        root.addView(title("Quick add"));
        root.addView(bodyText("Save a transaction without opening the full app."));

        LinearLayout kindRow = new LinearLayout(this);
        kindRow.setOrientation(LinearLayout.HORIZONTAL);
        kindRow.setGravity(Gravity.CENTER);
        kindRow.setPadding(0, dp(10), 0, dp(12));

        expenseButton = kindButton("Expense", KIND_EXPENSE);
        incomeButton = kindButton("Income", KIND_INCOME);
        transferButton = kindButton("Transfer", KIND_TRANSFER);
        kindRow.addView(expenseButton);
        kindRow.addView(incomeButton);
        kindRow.addView(transferButton);
        root.addView(kindRow);

        amountInput = input("Amount");
        amountInput.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        root.addView(amountInput);

        formFields = new LinearLayout(this);
        formFields.setOrientation(LinearLayout.VERTICAL);
        root.addView(formFields);

        noteInput = input("Note (optional)");
        noteInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        root.addView(noteInput);

        progressBar = new ProgressBar(this);
        progressBar.setVisibility(View.GONE);
        root.addView(progressBar);

        saveButton = primaryButton("Save transaction");
        saveButton.setOnClickListener(v -> save());
        root.addView(saveButton);

        Button cancel = secondaryButton("Cancel");
        cancel.setOnClickListener(v -> finish());
        root.addView(cancel);

        setContentView(root);
        rebuildKindUi();
    }

    private void rebuildKindUi() {
        if (formFields == null) return;
        styleKindButton(expenseButton, KIND_EXPENSE);
        styleKindButton(incomeButton, KIND_INCOME);
        styleKindButton(transferButton, KIND_TRANSFER);

        formFields.removeAllViews();
        if (KIND_TRANSFER.equals(kind)) {
            fromAccountSpinner = spinner("From account", session.accounts, store.lastFromAccountId());
            toAccountSpinner = spinner("To account", session.accounts, store.lastToAccountId());
            formFields.addView(label("From account"));
            formFields.addView(fromAccountSpinner);
            formFields.addView(label("To account"));
            formFields.addView(toAccountSpinner);
        } else {
            accountSpinner = spinner("Account", session.accounts, store.lastAccountId());
            categorySpinner = spinner(
                "Category",
                categoriesForKind(kind),
                store.lastCategoryId(kind)
            );
            formFields.addView(label("Account"));
            formFields.addView(accountSpinner);
            formFields.addView(label("Category"));
            formFields.addView(categorySpinner);
        }
    }

    private void save() {
        FirestoreWidgetTransactionClient.QuickAddInput input = readInput();
        List<String> errors = input.validate();
        if (!errors.isEmpty()) {
            Toast.makeText(this, errors.get(0), Toast.LENGTH_LONG).show();
            return;
        }

        setBusy(true);
        executor.execute(() -> {
            try {
                new FirestoreWidgetTransactionClient(session).createTransaction(input);
                store.rememberQuickAddDefaults(
                    input.kind,
                    input.accountId,
                    input.fromAccountId,
                    input.toAccountId,
                    input.categoryId
                );
                runOnUiThread(() -> {
                    Toast.makeText(this, "Transaction saved", Toast.LENGTH_SHORT).show();
                    finish();
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    setBusy(false);
                    Toast.makeText(this, e.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private FirestoreWidgetTransactionClient.QuickAddInput readInput() {
        FirestoreWidgetTransactionClient.QuickAddInput input = new FirestoreWidgetTransactionClient.QuickAddInput();
        input.kind = kind;
        input.amount = parseAmount(amountInput.getText().toString());
        input.note = noteInput.getText().toString();

        if (KIND_TRANSFER.equals(kind)) {
            input.fromAccountId = selectedId(fromAccountSpinner);
            input.toAccountId = selectedId(toAccountSpinner);
        } else {
            input.accountId = selectedId(accountSpinner);
            input.categoryId = selectedId(categorySpinner);
        }

        return input;
    }

    private double parseAmount(String raw) {
        try {
            return Double.parseDouble(raw.trim());
        } catch (Exception e) {
            return 0;
        }
    }

    private String selectedId(Spinner spinner) {
        if (spinner == null || spinner.getSelectedItem() == null) return "";
        return ((WidgetSessionStore.WidgetItem) spinner.getSelectedItem()).id;
    }

    private List<WidgetSessionStore.WidgetItem> categoriesForKind(String kind) {
        List<WidgetSessionStore.WidgetItem> filtered = new ArrayList<>();
        for (WidgetSessionStore.WidgetItem category : session.categories) {
            if (kind.equals(category.kind)) filtered.add(category);
        }
        return filtered;
    }

    private Spinner spinner(String prompt, List<WidgetSessionStore.WidgetItem> items, String preferredId) {
        Spinner spinner = new Spinner(this);
        spinner.setPrompt(prompt);
        spinner.setPadding(dp(8), 0, dp(8), 0);
        ArrayAdapter<WidgetSessionStore.WidgetItem> adapter = new ArrayAdapter<>(
            this,
            android.R.layout.simple_spinner_dropdown_item,
            items
        );
        spinner.setAdapter(adapter);

        int preferredIndex = preferredIndex(items, preferredId);
        if (preferredIndex >= 0) spinner.setSelection(preferredIndex);
        return spinner;
    }

    private int preferredIndex(List<WidgetSessionStore.WidgetItem> items, String preferredId) {
        if (preferredId != null && !preferredId.isEmpty()) {
            for (int i = 0; i < items.size(); i++) {
                if (preferredId.equals(items.get(i).id)) return i;
            }
        }
        return items.isEmpty() ? -1 : 0;
    }

    private LinearLayout rootLayout() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(22), dp(22), dp(22), dp(18));
        root.setBackgroundColor(Color.rgb(7, 19, 18));
        return root;
    }

    private TextView title(String text) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(Color.WHITE);
        view.setTextSize(24);
        view.setGravity(Gravity.CENTER);
        view.setPadding(0, 0, 0, dp(6));
        view.setTypeface(null, android.graphics.Typeface.BOLD);
        return view;
    }

    private TextView bodyText(String text) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(Color.rgb(203, 213, 225));
        view.setTextSize(14);
        view.setGravity(Gravity.CENTER);
        view.setPadding(0, 0, 0, dp(12));
        return view;
    }

    private TextView label(String text) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(Color.rgb(148, 163, 184));
        view.setTextSize(12);
        view.setPadding(0, dp(8), 0, dp(4));
        return view;
    }

    private EditText input(String hint) {
        EditText input = new EditText(this);
        input.setHint(hint);
        input.setHintTextColor(Color.rgb(100, 116, 139));
        input.setTextColor(Color.WHITE);
        input.setSingleLine(true);
        input.setPadding(dp(14), 0, dp(14), 0);
        return input;
    }

    private Button kindButton(String label, String value) {
        Button button = secondaryButton(label);
        button.setOnClickListener(v -> {
            kind = value;
            rebuildKindUi();
        });
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(42), 1);
        params.setMargins(dp(3), 0, dp(3), 0);
        button.setLayoutParams(params);
        return button;
    }

    private void styleKindButton(Button button, String value) {
        if (button == null) return;
        boolean selected = value.equals(kind);
        button.setTextColor(selected ? Color.WHITE : Color.rgb(203, 213, 225));
        button.setBackgroundColor(selected ? Color.rgb(15, 118, 110) : Color.rgb(21, 35, 33));
    }

    private Button primaryButton(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setTextColor(Color.WHITE);
        button.setBackgroundColor(Color.rgb(13, 148, 136));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(52)
        );
        params.setMargins(0, dp(12), 0, 0);
        button.setLayoutParams(params);
        return button;
    }

    private Button secondaryButton(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setTextColor(Color.rgb(203, 213, 225));
        button.setBackgroundColor(Color.rgb(21, 35, 33));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(48)
        );
        params.setMargins(0, dp(8), 0, 0);
        button.setLayoutParams(params);
        return button;
    }

    private void setBusy(boolean busy) {
        saveButton.setEnabled(!busy);
        progressBar.setVisibility(busy ? View.VISIBLE : View.GONE);
    }

    private String normalizeKind(String raw) {
        if (KIND_INCOME.equals(raw) || KIND_TRANSFER.equals(raw)) return raw;
        return KIND_EXPENSE;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
