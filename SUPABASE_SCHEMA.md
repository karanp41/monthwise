# Supabase Database Schema Changes

## Required Changes for Payment History Tracking

### 1. Create `bill_payments` Table

This table will track all payment history for bills, allowing users to see which months have been paid.

```sql
-- Create bill_payments table
CREATE TABLE bill_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    amount DECIMAL(10, 2) NOT NULL,
    payment_month DATE NOT NULL, -- Store as first day of the month (e.g., 2025-11-01)
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_bill_payments_bill_id ON bill_payments(bill_id);
CREATE INDEX idx_bill_payments_user_id ON bill_payments(user_id);
CREATE INDEX idx_bill_payments_payment_month ON bill_payments(payment_month);

-- Enable RLS (Row Level Security)
ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own bill payments"
    ON bill_payments FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bill payments"
    ON bill_payments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bill payments"
    ON bill_payments FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bill payments"
    ON bill_payments FOR DELETE
    USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bill_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bill_payments_updated_at
    BEFORE UPDATE ON bill_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_bill_payments_updated_at();

-- Create trigger to update next_due_date on bills when payment is inserted or deleted
CREATE OR REPLACE FUNCTION update_bill_next_due_date_trigger()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE bills SET next_due_date = get_bill_next_due_date(
        CASE WHEN TG_OP = 'DELETE' THEN OLD.bill_id ELSE NEW.bill_id END,
        CURRENT_DATE
    ) WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.bill_id ELSE NEW.bill_id END;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bill_next_due_date_insert
    AFTER INSERT ON bill_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_bill_next_due_date_trigger();

CREATE TRIGGER trigger_update_bill_next_due_date_delete
    AFTER DELETE ON bill_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_bill_next_due_date_trigger();
```

### 2. Update `bills` Table (Optional Enhancement)

Add a column to track the next due date for recurring bills:

```sql
-- Add next_due_date column to bills table
ALTER TABLE bills ADD COLUMN IF NOT EXISTS next_due_date DATE;

-- Update existing bills to set next_due_date
UPDATE bills SET next_due_date = due_date::date WHERE next_due_date IS NULL;
```

### 3. Create Helper Function for Monthly Bill Generation

This function helps determine the effective due date for a bill in a given month:

```sql
-- Function to get the next unpaid month for a recurring bill
CREATE OR REPLACE FUNCTION get_bill_next_due_date(
    p_bill_id UUID,
    p_current_date DATE DEFAULT CURRENT_DATE
)
RETURNS DATE AS $$
DECLARE
    v_bill_due_date DATE;
    v_recurrence TEXT;
    v_next_due DATE;
    v_last_payment_month DATE;
BEGIN
    -- Get bill details
    SELECT due_date::date, recurrence
    INTO v_bill_due_date, v_recurrence
    FROM bills
    WHERE id = p_bill_id;

    -- If not recurring, return the original due date
    IF v_recurrence = 'none' THEN
        RETURN v_bill_due_date;
    END IF;

    -- Get the last payment month
    SELECT MAX(payment_month)
    INTO v_last_payment_month
    FROM bill_payments
    WHERE bill_id = p_bill_id;

    -- Calculate next due date based on recurrence
    IF v_recurrence = 'monthly' THEN
        IF v_last_payment_month IS NULL THEN
            -- No payments yet, use current month
            v_next_due := DATE_TRUNC('month', p_current_date)::date + 
                         (EXTRACT(DAY FROM v_bill_due_date) - 1)::int;
        ELSE
            -- Next month after last payment
            v_next_due := DATE_TRUNC('month', v_last_payment_month + INTERVAL '1 month')::date + 
                         (EXTRACT(DAY FROM v_bill_due_date) - 1)::int;
        END IF;
    ELSIF v_recurrence = 'yearly' THEN
        IF v_last_payment_month IS NULL THEN
            v_next_due := v_bill_due_date;
        ELSE
            v_next_due := DATE_TRUNC('year', v_last_payment_month + INTERVAL '1 year')::date + 
                         (EXTRACT(MONTH FROM v_bill_due_date) - 1) * INTERVAL '1 month' + 
                         (EXTRACT(DAY FROM v_bill_due_date) - 1) * INTERVAL '1 day';
        END IF;
    END IF;

    RETURN v_next_due;
END;
$$ LANGUAGE plpgsql;
```

## Migration Steps

1. **Run the SQL commands** in your Supabase SQL Editor in the following order:
   - Create `bill_payments` table
   - Create indexes
   - Enable RLS and create policies
   - Create update trigger
   - (Optional) Add `next_due_date` column to `bills` table
   - (Optional) Create helper function

2. **Verify the changes**:
   ```sql
   -- Check if table was created
   SELECT * FROM bill_payments LIMIT 1;
   
   -- Check RLS policies
   SELECT * FROM pg_policies WHERE tablename = 'bill_payments';
   ```

## Key Features

1. **Payment History**: Track every payment made for each bill
2. **Monthly Tracking**: `payment_month` stores which month the payment is for
3. **Recurring Bill Support**: Automatically calculate next due date based on payment history
4. **Audit Trail**: Track when payments were made with `payment_date` and `created_at`
5. **Amount Flexibility**: Store actual amount paid (could differ from bill amount)

## Usage Example

```sql
-- Record a payment for November 2025
INSERT INTO bill_payments (bill_id, user_id, amount, payment_month, notes)
VALUES (
    'bill-uuid-here',
    'user-uuid-here',
    99.99,
    '2025-11-01',
    'Paid via credit card'
);

-- Get all payments for a specific bill
SELECT * FROM bill_payments
WHERE bill_id = 'bill-uuid-here'
ORDER BY payment_month DESC;

-- Check if current month is paid for a bill
SELECT EXISTS (
    SELECT 1 FROM bill_payments
    WHERE bill_id = 'bill-uuid-here'
    AND payment_month = DATE_TRUNC('month', CURRENT_DATE)
) AS is_current_month_paid;
```

## Required Changes for Currency Support

### 1. Add `default_currency` column to `users` table

```sql
-- Add default_currency column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_currency VARCHAR(3) DEFAULT 'USD';
```

### 2. Add `currency` column to `bills` table

```sql
-- Add currency column to bills table
ALTER TABLE bills ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD';
```

### 3. Add `currency` column to `bill_payments` table

```sql
-- Add currency column to bill_payments table
ALTER TABLE bill_payments ADD COLUMN IF NOT EXISTS currency VARCHAR(3);
```

### 4. Update existing bills to use user's default currency

```sql
-- Update existing bills to set currency from user's default_currency
UPDATE bills SET currency = users.default_currency
FROM users
WHERE bills.user_id = users.id AND bills.currency IS NULL;

-- Update existing payments to set currency from bill's currency
UPDATE bill_payments SET currency = bills.currency
FROM bills
WHERE bill_payments.bill_id = bills.id AND bill_payments.currency IS NULL;
```

## Migration Steps

1. **Run the SQL commands** in your Supabase SQL Editor in the following order:
   - Add `default_currency` column to `users` table
   - Add `currency` column to `bills` table
   - Update existing bills with user's default currency

2. **Verify the changes**:
   ```sql
   -- Check if columns were added
   SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'default_currency';
   SELECT column_name FROM information_schema.columns WHERE table_name = 'bills' AND column_name = 'currency';
   ```
