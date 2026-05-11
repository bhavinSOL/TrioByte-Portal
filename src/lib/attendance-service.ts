import { supabase } from "../integrations/supabase/client";

export interface WorkingHours {
  start_time: string; // "HH:mm" format
  end_time: string;   // "HH:mm" format
  user_id?: string;
}

/**
 * Automatically log in user when they first access the app
 */
export async function autoLoginUser(userId: string): Promise<boolean> {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if already logged in today
    const { data: existing } = await (supabase as any)
      .from("attendance")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    if (existing) {
      return false; // Already logged in
    }

    // Create new attendance record with login time
    const { error } = await (supabase as any)
      .from("attendance")
      .insert({
        user_id: userId,
        date: today,
        login_time: new Date().toISOString(),
        status: "present",
      });

    if (error) throw error;
    return true; // Successfully logged in
  } catch (error) {
    console.error("Auto login failed:", error);
    return false;
  }
}

/**
 * Get user's working hours from preferences
 */
export async function getUserWorkingHours(userId: string): Promise<WorkingHours | null> {
  try {
    const { data } = await (supabase as any)
      .from("user_preferences")
      .select("work_start_time, work_end_time")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      return {
        start_time: data.work_start_time || "09:00",
        end_time: data.work_end_time || "18:00",
      };
    }

    // Default working hours
    return {
      start_time: "09:00",
      end_time: "18:00",
    };
  } catch (error) {
    console.error("Error fetching working hours:", error);
    return {
      start_time: "09:00",
      end_time: "18:00",
    };
  }
}

/**
 * Update user's working hours
 */
export async function updateUserWorkingHours(
  userId: string,
  startTime: string,
  endTime: string
): Promise<boolean> {
  try {
    const { error } = await (supabase as any)
      .from("user_preferences")
      .upsert({
        user_id: userId,
        work_start_time: startTime,
        work_end_time: endTime,
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error updating working hours:", error);
    return false;
  }
}

/**
 * Automatically log out user at end of working hours
 */
export async function autoLogoutAtEndOfDay(userId: string): Promise<boolean> {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get today's attendance record
    const { data: attendance } = await (supabase as any)
      .from("attendance")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    if (!attendance || attendance.logout_time) {
      return false; // Already logged out or no record
    }

    // Get user's working hours
    const workingHours = await getUserWorkingHours(userId);
    if (!workingHours) return false;

    // Parse end time
    const [endHour, endMinute] = workingHours.end_time.split(":").map(Number);
    const now = new Date();
    const endTime = new Date(now);
    endTime.setHours(endHour, endMinute, 0, 0);

    // If current time is past end time, auto-logout
    if (now >= endTime) {
      const { error } = await (supabase as any)
        .from("attendance")
        .update({ logout_time: endTime.toISOString() })
        .eq("id", attendance.id);

      if (error) throw error;
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error auto logging out:", error);
    return false;
  }
}

/**
 * Check if user needs auto logout (called periodically)
 */
export async function checkAndAutoLogout(userId: string): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get today's attendance
    const { data: attendance } = await (supabase as any)
      .from("attendance")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    if (!attendance || attendance.logout_time) return; // No active session

    // Get working hours
    const workingHours = await getUserWorkingHours(userId);
    if (!workingHours) return;

    const [endHour, endMinute] = workingHours.end_time.split(":").map(Number);
    const now = new Date();
    const endTime = new Date(now);
    endTime.setHours(endHour, endMinute, 0, 0);

    // If past end time and no logout recorded, auto-logout
    if (now >= endTime && !attendance.logout_time) {
      await (supabase as any)
        .from("attendance")
        .update({ logout_time: endTime.toISOString() })
        .eq("id", attendance.id);
    }
  } catch (error) {
    console.error("Error in auto logout check:", error);
  }
}

/**
 * Calculate hours worked
 */
export function calculateHoursWorked(loginTime: string, logoutTime: string | null): number {
  if (!logoutTime) return 0;
  const login = new Date(loginTime).getTime();
  const logout = new Date(logoutTime).getTime();
  return (logout - login) / (1000 * 60 * 60);
}

/**
 * Get attendance summary for admin
 */
export async function getAttendanceSummary(
  date: string
): Promise<
  Array<{
    user_id: string;
    full_name: string;
    login_time: string | null;
    logout_time: string | null;
    hours_worked: number;
    status: string;
  }>
> {
  try {
    const { data: records } = await (supabase as any)
      .from("attendance")
      .select("*")
      .eq("date", date);

    if (!records) return [];

    // Fetch profile data for each record
    const enriched = await Promise.all(
      records.map(async (record: any) => {
        const { data: profile } = await (supabase as any)
          .from("profiles")
          .select("full_name")
          .eq("id", record.user_id)
          .maybeSingle();

        return {
          user_id: record.user_id,
          full_name: profile?.full_name || "Unknown",
          login_time: record.login_time,
          logout_time: record.logout_time,
          hours_worked: calculateHoursWorked(
            record.login_time,
            record.logout_time
          ),
          status: record.status,
        };
      })
    );

    return enriched;
  } catch (error) {
    console.error("Error getting attendance summary:", error);
    return [];
  }
}

/**
 * Update attendance record (admin only)
 */
export async function updateAttendanceRecord(
  recordId: string,
  updates: {
    login_time?: string;
    logout_time?: string;
    status?: string;
  }
): Promise<boolean> {
  try {
    const { error } = await (supabase as any)
      .from("attendance")
      .update(updates)
      .eq("id", recordId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error updating attendance:", error);
    return false;
  }
}
