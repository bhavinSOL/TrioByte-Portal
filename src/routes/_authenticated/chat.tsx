import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/portal/page-header";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useRef } from "react";
import { Loader2, Send, MessageSquare, Eye, Mic, FileUp, Search, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Chat — TrioByte Portal" }] }),
  component: ChatPage,
});

interface ChatMessage {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
  file_url?: string | null;
  file_type?: string | null;
  is_read?: boolean;
  is_delivered?: boolean;
  read_at?: string | null;
  profiles?: { full_name: string | null };
}

interface Employee {
  id: string;
  full_name: string | null;
  photo_url: string | null;
}

function ChatPage() {
  const { profile, primaryRole } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [allMessages, setAllMessages] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      loadMessages();
      const interval = setInterval(loadMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedUser]);

  useEffect(() => {
    if (isMonitoring && (primaryRole === "hr_admin" || primaryRole === "founder")) {
      loadAllMessages();
      const interval = setInterval(loadAllMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [isMonitoring, primaryRole]);

  const loadEmployees = async () => {
    try {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, photo_url")
        .neq("id", profile?.id)
        .order("full_name");
      setEmployees(data || []);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!selectedUser) return;
    try {
      const { data } = await (supabase as any)
        .from("chat_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${profile?.id},recipient_id.eq.${selectedUser}),and(sender_id.eq.${selectedUser},recipient_id.eq.${profile?.id})`
        )
        .order("created_at", { ascending: true });
      setMessages(data || []);

      // Mark incoming messages as read
      if (data && data.length > 0) {
        const unreadMessages = data.filter(
          (msg: ChatMessage) => msg.recipient_id === profile?.id && !msg.is_read
        );

        if (unreadMessages.length > 0) {
          await Promise.all(
            unreadMessages.map((msg: ChatMessage) =>
              (supabase as any)
                .from("chat_messages")
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq("id", msg.id)
            )
          );
        }
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const loadAllMessages = async () => {
    try {
      const { data } = await (supabase as any)
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      // Fetch sender and recipient names separately
      if (data && data.length > 0) {
        const enrichedData = await Promise.all(
          data.map(async (msg: any) => {
            const [senderData, recipientData] = await Promise.all([
              (supabase as any)
                .from("profiles")
                .select("full_name")
                .eq("id", msg.sender_id)
                .maybeSingle(),
              (supabase as any)
                .from("profiles")
                .select("full_name")
                .eq("id", msg.recipient_id)
                .maybeSingle(),
            ]);
            return {
              ...msg,
              sender: senderData.data,
              recipient: recipientData.data,
            };
          })
        );
        setAllMessages(enrichedData);
      } else {
        setAllMessages(data || []);
      }
    } catch (error) {
      console.error("Error loading all messages:", error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([audioBlob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        setRecordedFile(file);
        toast.success("Voice note recorded");
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      toast.error("Cannot access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 10) {
      toast.error("File size must be less than 10 MB");
      return;
    }

    setRecordedFile(file);
    toast.success("File selected");
  };

  const getMessageStatus = (msg: ChatMessage) => {
    if (msg.sender_id !== profile?.id) return null; // Only show status for sent messages

    if (msg.is_read) {
      return "✓✓"; // Read
    } else if (msg.is_delivered) {
      return "✓✓"; // Delivered
    } else {
      return "✓"; // Sent
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${profile?.id}/${Date.now()}.${fileExt}`;

      // Upload file to storage
      const { error } = await supabase.storage
        .from("chat-files")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false
        });

      if (error) {
        console.error("Upload error:", error);
        throw error;
      }

      // Get public URL
      const { data } = supabase.storage
        .from("chat-files")
        .getPublicUrl(fileName);

      return data?.publicUrl || null;
    } catch (error: any) {
      console.error("File upload failed:", error);
      toast.error("Failed to upload file: " + error.message);
      return null;
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageText.trim() && !recordedFile) || !selectedUser) return;

    try {
      setIsSending(true);
      let fileUrl = null;
      let fileType = null;
      let fileName = "";

      if (recordedFile) {
        fileUrl = await uploadFile(recordedFile);
        fileType = recordedFile.type.startsWith("audio") ? "voice" : "document";
        fileName = recordedFile.name;
        if (!fileUrl) return;
      }

      const messageContent = messageText.trim() ||
        (fileType === "voice" ? "🎙️ Sent a voice note" : `📎 ${fileName}`);

      const { error } = await (supabase as any)
        .from("chat_messages")
        .insert({
          sender_id: profile?.id,
          recipient_id: selectedUser,
          message: messageContent,
          file_url: fileUrl,
          file_type: fileType,
        });

      if (error) throw error;
      setMessageText("");
      setRecordedFile(null);
      await loadMessages();
    } catch (error: any) {
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (isLoading) {
    return (
      <>
        <PageHeader title="Team Chat" description="Direct and group conversations with your colleagues." />
        <PageBody>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Team Chat"
        description={isMonitoring ? "Monitoring all team messages" : "Direct messages with your colleagues."}
        actions={
          (primaryRole === "hr_admin" || primaryRole === "founder") && (
            <Button
              size="sm"
              variant={isMonitoring ? "default" : "outline"}
              onClick={() => setIsMonitoring(!isMonitoring)}
            >
              <Eye className="mr-2 h-4 w-4" />
              {isMonitoring ? "Stop Monitoring" : "Monitor All"}
            </Button>
          )
        }
      />
      <PageBody>
        {isMonitoring && (primaryRole === "hr_admin" || primaryRole === "founder") ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Message Monitoring</CardTitle>
              <CardDescription>All team messages (admin view)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {allMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No messages yet</p>
                ) : (
                  allMessages.map((msg) => (
                    <div key={msg.id} className="border border-border rounded-lg p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{msg.sender?.full_name || "Unknown"}</Badge>
                          <span className="text-xs text-muted-foreground">→</span>
                          <Badge variant="outline">{msg.recipient?.full_name || "Unknown"}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm">{msg.message}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
        <div className="grid gap-4 lg:grid-cols-4 h-[600px]">
          <Card className="lg:col-span-1 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Messages</CardTitle>
              <div className="relative mt-3">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-1 px-4 pb-4">
              {employees.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No colleagues</p>
              ) : (
                employees
                  .filter(emp => emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((emp) => (
                    <button
                      key={emp.id}
                      onClick={() => setSelectedUser(emp.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        selectedUser === emp.id
                          ? "bg-blue-600 text-white"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="relative h-10 w-10 flex-shrink-0">
                        {emp.photo_url ? (
                          <img
                            src={emp.photo_url}
                            alt={emp.full_name || ""}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                            {(emp.full_name || "?")
                              .split(" ")
                              .map(n => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-sm font-medium truncate">{emp.full_name || "—"}</div>
                      </div>
                    </button>
                  ))
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3 flex flex-col">
            {!selectedUser ? (
              <CardContent className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a conversation to start messaging</p>
                </div>
              </CardContent>
            ) : (
              <>
                <CardHeader className="border-b border-border pb-3">
                  <div className="flex items-center gap-3">
                    {employees.find(e => e.id === selectedUser)?.photo_url ? (
                      <img
                        src={employees.find(e => e.id === selectedUser)?.photo_url || ""}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold">
                        {(employees.find(e => e.id === selectedUser)?.full_name || "?")
                          .split(" ")
                          .map(n => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-base">{employees.find(e => e.id === selectedUser)?.full_name || "—"}</CardTitle>
                      <p className="text-xs text-muted-foreground">Online</p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_id === profile?.id ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-xs px-4 py-2 rounded-lg ${
                            msg.sender_id === profile?.id
                              ? "bg-primary text-primary-foreground rounded-br-none"
                              : "bg-muted rounded-bl-none"
                          }`}
                        >
                          {msg.file_type === "voice" && msg.file_url ? (
                            <div className="mb-2">
                              <p className="text-xs mb-1 opacity-75">🎙️ Voice note</p>
                              <audio controls className="w-full max-w-xs h-8" style={{ filter: msg.sender_id === profile?.id ? "brightness(1.2)" : "none" }}>
                                <source src={msg.file_url} type="audio/webm" />
                                Your browser does not support the audio element.
                              </audio>
                            </div>
                          ) : msg.file_type === "document" && msg.file_url ? (
                            <div className="mb-2">
                              <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="text-sm underline hover:opacity-80">
                                {msg.message}
                              </a>
                            </div>
                          ) : null}
                          {!msg.file_type && msg.message && (
                            <p className="text-sm">{msg.message}</p>
                          )}
                          <div className="flex items-end justify-between gap-2 mt-1">
                            <p className={`text-xs ${msg.sender_id === profile?.id ? "opacity-70" : "text-muted-foreground"}`}>
                              {new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                            {msg.sender_id === profile?.id && (
                              <span className={`text-xs font-semibold ${msg.is_read ? "text-green-400" : "opacity-70"}`}>
                                {getMessageStatus(msg)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>

                <div className="border-t border-border p-4 space-y-3">
                  {recordedFile && (
                    <div className="bg-muted p-2 rounded text-sm flex items-center justify-between">
                      <span>📁 {recordedFile.name} ({(recordedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRecordedFile(null)}
                      >
                        ✕
                      </Button>
                    </div>
                  )}
                  <form onSubmit={sendMessage} className="flex gap-2">
                    <Input
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Type a message..."
                      disabled={isSending || isRecording}
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSending || isRecording}
                      title="Upload file"
                    >
                      <FileUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant={isRecording ? "default" : "outline"}
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isSending}
                      title={isRecording ? "Stop recording" : "Start recording"}
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                    <Button type="submit" disabled={isSending || (!messageText.trim() && !recordedFile)} size="icon">
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
                </div>
              </>
            )}
          </Card>
        </div>
        )}
      </PageBody>
    </>
  );
}
