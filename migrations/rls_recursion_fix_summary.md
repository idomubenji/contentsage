# RLS Recursion Fix Summary

## The Problem

Our application encountered an infinite recursion error in Supabase's Row Level Security (RLS) policies for the `user_organizations` table:

```
"infinite recursion detected in policy for relation \"user_organizations\""
```

This error occurred because:

1. Complex policies with circular references were created on `user_organizations` table
2. Some policies used self-referential subqueries (policies that query the same table they're securing)
3. When retrieving organization data, these circular references triggered infinite recursion

## The Solution

We implemented a minimalist approach that completely eliminated the recursion:

1. **Drop all existing policies** on the `user_organizations` table
2. **Reset RLS completely** (disable and re-enable)
3. **Create four ultra-simple policies** that avoid any self-references:
   ```sql
   -- 1. Users can view their own entries
   CREATE POLICY "policy_select_own" ON user_organizations 
     FOR SELECT 
     USING (user_id = auth.uid());

   -- 2. Users can insert only their own entries
   CREATE POLICY "policy_insert_own" ON user_organizations 
     FOR INSERT
     WITH CHECK (user_id = auth.uid());

   -- 3. Users can delete their own entries
   CREATE POLICY "policy_delete_own" ON user_organizations 
     FOR DELETE
     USING (user_id = auth.uid());

   -- 4. Users can update their own entries
   CREATE POLICY "policy_update_own" ON user_organizations
     FOR UPDATE
     USING (user_id = auth.uid());
   ```
4. **Grant explicit permissions** to authenticated users

## Why This Works

The new policies:

1. Contain **no subqueries** that could create circular references
2. Use **simple equality checks** (`user_id = auth.uid()`) for permissions
3. Avoid any **self-referential lookups** to determine admin status
4. Maintain basic security while eliminating complexity that caused recursion

## Future RLS Policy Development Guidelines

When expanding RLS policies, follow these guidelines to prevent recursion:

1. **Avoid self-referencing subqueries** in policy definitions
2. **Use table aliases** when you must reference the same table
3. **Prefer EXISTS over IN** for better performance and less recursion risk
4. **Test policies incrementally** - add one at a time and verify
5. **Favor simplicity** over complex policy logic
6. For **admin functionality** that requires more complex permissions:
   - Consider handling through API endpoints with service_role client
   - Or use carefully structured policies that avoid circular references

## Database Security Note

While the implemented policies are simpler, they maintain the core security principle of RLS - users can only access/modify their own data. Future development can gradually introduce more complex policies as needed, but should always be tested for recursion issues.

---

*Migration applied: [date] - Fixed RLS recursion by implementing minimal non-recursive policies* 