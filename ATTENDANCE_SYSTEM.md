# Attendance Tracking System Documentation

## Overview

The TrioByte Portal now includes a comprehensive attendance tracking system that:

1. **Automatic Login** - Employees are automatically logged in when they first access the portal
2. **Manual Logout** - Employees can manually log out to end their working day
3. **Auto-Logout** - Employees who don't log out are automatically logged out at end of working hours
4. **Daily Hours Tracking** - System tracks and calculates daily working hours
5. **Admin Management** - Admins can edit attendance records and manage working hours

---

## Features

### For Employees

#### Automatic Login
- When an employee logs in to the portal, they are automatically marked as "present"
- No manual action required for login
- Login time is recorded in the attendance table

#### Manual Logout
- Employees can manually click "Log Out" button on the attendance page
- Logout time is recorded
- Hours worked are calculated automatically

#### View Attendance History
- Employees can view their last 30 days of attendance records
- See login times, logout times, and hours worked
- View daily status (present, leave, half_day, absent)

#### Dashboard Attendance Stats
- Quick view of today's login/logout status
- Monthly attendance summary
- Hours worked tracking

---

### For Admins (HR/Founder)

#### View All Attendance
- Browse employee attendance records by date
- See login/logout times for all employees
- View hours worked calculations

#### Edit Attendance Records
- Manually adjust login/logout times if needed
- Correct errors in attendance tracking
- Buttons available on attendance records

#### Manage Working Hours
- Set custom working hours for each employee
- Default: 09:00 - 18:00
- Used for automatic logout calculation
- Access via Attendance Settings page

#### Auto-Logout Management
- System automatically logs out employees at end of working hours
- Runs every minute (configurable)
- Employees who forget to logout are handled automatically

---

## How It Works

### Automatic Login Flow

```
Employee opens portal
  ↓
Auth provider loads
  ↓
System checks if employee already logged in today
  ↓
If NO → Auto-login (create attendance record with current time)
If YES → Skip (already logged in)
```

### Auto-Logout Flow

```
Every minute (when app is running):
  ↓
Check all active sessions (no logout_time)
  ↓
Get employee's working end time from user_preferences
  ↓
Compare current time with working end time
  ↓
If current time >= end time → Auto-logout (set logout_time to end time)
```

---

## Database Schema

### attendance table

```sql
CREATE TABLE attendance (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  date date NOT NULL,
  login_time timestamptz,
  logout_time timestamptz,
  status text DEFAULT 'absent',
  auto_logged_out boolean DEFAULT false,
  created_at timestamptz,
  updated_at timestamptz,
  UNIQUE(user_id, date)
);
```

### user_preferences table

```sql
CREATE TABLE user_preferences (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  work_start_time time DEFAULT '09:00',
  work_end_time time DEFAULT '18:00',
  ...
);
```

---

## API/Service Functions

### From `attendance-service.ts`:

#### `autoLoginUser(userId: string): Promise<boolean>`
Automatically logs in a user when they access the app.

```typescript
await autoLoginUser(userId);
```

#### `getUserWorkingHours(userId: string): Promise<WorkingHours | null>`
Gets user's custom working hours.

```typescript
const hours = await getUserWorkingHours(userId);
// Returns: { start_time: "09:00", end_time: "18:00" }
```

#### `updateUserWorkingHours(userId: string, startTime: string, endTime: string)`
Updates user's working hours.

```typescript
await updateUserWorkingHours(userId, "08:00", "17:00");
```

#### `checkAndAutoLogout(userId: string): Promise<void>`
Checks if user needs auto-logout and processes it.

```typescript
await checkAndAutoLogout(userId);
```

#### `calculateHoursWorked(loginTime: string, logoutTime: string | null): number`
Calculates hours worked between login and logout.

```typescript
const hours = calculateHoursWorked(record.login_time, record.logout_time);
// Returns: 8.5
```

#### `updateAttendanceRecord(recordId: string, updates: {...}): Promise<boolean>`
Admin function to update attendance records.

```typescript
await updateAttendanceRecord(recordId, {
  login_time: "2026-05-05T09:30:00Z",
  logout_time: "2026-05-05T18:00:00Z"
});
```

---

## Pages

### Employee Attendance (`/attendance`)

**View**: Shows today's attendance with login/logout buttons
- Today's login time
- Today's logout time
- Hours worked today
- Manual login/logout buttons
- Last 30 days history

**Actions**:
- Click "Log in" to manually login
- Click "Log out" to manually logout
- View attendance history

---

### Admin Attendance (`/attendance` - admin view)

**View**: Shows all employees' attendance for selected date
- Date selector (navigate between days)
- Employee list with login/logout times
- Hours worked for each employee
- Status badge

**Actions**:
- Click "Edit" (pencil icon) to edit times
- Click "Clock" icon to manage working hours
- Edit login/logout times directly
- Save or cancel edits

---

### Attendance Settings (`/attendance-settings`)

**Tabs**:

#### Working Hours
- List of all employees
- Click "Edit" to set custom working hours
- Start time and end time inputs
- Save changes

#### Policies
- Toggle "Auto-login on app access"
- Toggle "Auto-logout at end of working hours"
- (Policy persistence can be added to settings table)

---

## Implementation in Auth Provider

The auto-login and auto-logout checks are integrated into the auth provider:

```typescript
// In src/lib/auth.tsx

export function AuthProvider({ children }) {
  // ... existing code ...

  // Setup auto-logout check interval (every minute)
  useEffect(() => {
    if (!session?.user?.id) return;

    const interval = setInterval(async () => {
      await checkAndAutoLogout(session.user.id);
    }, 60000); // Check every minute

    // Also check immediately on mount
    checkAndAutoLogout(session.user.id);

    return () => clearInterval(interval);
  }, [session?.user?.id]);

  // ... rest of code ...
}
```

---

## Configuration

### Default Working Hours
- **Start**: 09:00 (9 AM)
- **End**: 18:00 (6 PM)

### Auto-Logout Check Frequency
- Every minute (configurable via interval in auth provider)

### Adjustment for Different Time Zones
Current implementation uses server time. To support time zones:
1. Store user's timezone in `user_preferences`
2. Adjust end time calculation based on timezone offset

---

## Future Enhancements

1. **Time Zone Support** - Store and respect user timezones
2. **Geolocation Tracking** - Track login/logout location
3. **Attendance Analytics** - Dashboard with attendance charts
4. **Bulk Operations** - Mark multiple employees as absent/on leave
5. **Notifications** - Alert employees before auto-logout
6. **Time Clock Widget** - Floating widget showing real-time hours
7. **Late Penalty Tracking** - Track late arrivals and early departures
8. **Overtime Tracking** - Monitor and report overtime hours

---

## Troubleshooting

### Employee Not Auto-Logging In
- Check if auto-login is enabled in policies
- Verify user has "employee" role in user_roles table
- Check browser console for errors

### Auto-Logout Not Working
- Verify user_preferences table has work_end_time set
- Check if auth provider interval is running (every minute)
- Verify attendance record exists for today

### Wrong Hours Calculated
- Check login_time and logout_time formats in database
- Ensure both times are on same date
- Verify time zone handling

---

## Security Considerations

1. **RLS Policies** - Employees can only view their own records
2. **Admin Only** - Only HR/Founder can edit records and manage hours
3. **Audit Trail** - Updated_at timestamps track when records were modified
4. **Auto-Logout Flag** - Track which logouts were automatic vs manual

---

## Testing

### Manual Testing Checklist

- [ ] Employee logs in - auto-login creates attendance record
- [ ] Employee manual logout - logout time is recorded
- [ ] Hours calculation - formula works correctly
- [ ] Admin edit - can modify login/logout times
- [ ] Working hours - auto-logout triggers at end time
- [ ] Multi-employee - system handles multiple concurrent sessions
- [ ] Edge cases - handles missing times, future dates, etc.

---

## Support

For issues or questions about the attendance system:
1. Check error logs in browser console
2. Verify Supabase tables have correct data
3. Check user permissions and roles
4. Review migration files for schema
