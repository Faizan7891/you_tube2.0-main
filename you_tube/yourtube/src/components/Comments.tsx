import React, { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { formatDistanceToNow } from "date-fns";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import "altcha";

interface Comment {
  _id: string;
  videoid: string;
  userid: string | any;
  commentbody: string;
  usercommented: string;
  status?: "active" | "deleted";
  editVersion?: number;

  username?: string;
  profileImage?: string;
  location?: string;

  commentedon: string;
  postedAt?: string;
  createdAt?: string;

  isEdited?: boolean;
  editedAt?: string;

  parentCommentId?: string | null;
  mentions?: string[];
}

interface MentionUser {
  _id: string;
  username: string;
  name?: string;
  image?: string;
}

interface Reaction {
  likes: number;
  dislikes: number;
  userReaction: "like" | "dislike" | null;
}

const MAX_COMMENT_LENGTH = 500;

const Comments = ({ videoId }: any) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isReplying, setIsReplying] = useState(false);

  const [reactions, setReactions] = useState<Record<string, Reaction>>({});

  const { user } = useUser();
  const [loading, setLoading] = useState(true);

  const [sortOption, setSortOption] = useState("newest");

  const [expiredComments, setExpiredComments] = useState<
    Record<string, boolean>
  >({});

  // =========================
  // @MENTIONS
  // =========================
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionUser[]>(
    [],
  );
  const [mentionTarget, setMentionTarget] = useState<
    "comment" | "reply" | "edit" | null
  >(null);
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [replyError, setReplyError] = useState("");
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(
    null,
  );

  const [reportError, setReportError] = useState("");

  const [reportSuccess, setReportSuccess] = useState("");
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [translationError, setTranslationError] = useState<
    Record<string, string>
  >({});
  const [showTranslateOptions, setShowTranslateOptions] = useState<
    string | null
  >(null);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  // =========================
  // LOAD REACTIONS
  // =========================
  const loadReactions = async (commentId: string) => {
    try {
      const res = await axiosInstance.get(`/comment-reaction/${commentId}`);

      setReactions((prev) => ({
        ...prev,
        [commentId]: {
          likes: res.data.likes || 0,
          dislikes: res.data.dislikes || 0,
          userReaction: res.data.userReaction || null,
        },
      }));
    } catch (error) {
      console.error("Error loading reactions:", error);
    }
  };

  // =========================
  // LOAD COMMENTS
  // =========================
  const loadComments = async () => {
    try {
      const res = await axiosInstance.get(`/comment/${videoId}`);

      setComments(res.data);

      for (const currentComment of res.data) {
        await loadReactions(currentComment._id);
      }
    } catch (error) {
      console.error("Error loading comments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadComments();
  }, [videoId]);

  // =========================
  // EDIT / DELETE TIME LIMIT
  // =========================
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    comments.forEach((comment) => {
      if (!comment.createdAt) return;

      const createdTime = new Date(comment.createdAt).getTime();

      const tenMinutes = 10 * 60 * 1000;

      const remainingTime = tenMinutes - (Date.now() - createdTime);

      if (remainingTime <= 0) {
        setExpiredComments((prev) => ({
          ...prev,
          [comment._id]: true,
        }));

        return;
      }

      const timer = setTimeout(() => {
        setExpiredComments((prev) => ({
          ...prev,
          [comment._id]: true,
        }));
      }, remainingTime);

      timers.push(timer);
    });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [comments]);

  const canEditOrDelete = (comment: Comment) => {
    if (!comment.createdAt) {
      return false;
    }

    if (expiredComments[comment._id]) {
      return false;
    }

    const createdTime = new Date(comment.createdAt).getTime();

    const tenMinutes = 10 * 60 * 1000;

    return Date.now() - createdTime < tenMinutes;
  };

  const handleReport = async (commentId: string, reason: string) => {
    setReportError("");
    setReportSuccess("");

    try {
      const res = await axiosInstance.post(`/comment/report/${commentId}`, {
        reason,
      });

      setReportSuccess(res.data.message || "Comment reported successfully.");

      setReportingCommentId(null);
    } catch (error: any) {
      setReportError(
        error?.response?.data?.message || "Unable to report comment.",
      );
    }
  };
  // =========================
  // @MENTION HELPERS
  // =========================
  const handleMentionInput = async (
    value: string,
    target: "comment" | "reply" | "edit",
  ) => {
    setMentionTarget(target);

    const match = value.match(/(^|\s)@([a-zA-Z0-9_]*)$/);

    if (!match) {
      setMentionSuggestions([]);
      setMentionTarget(null);
      setMentionStart(-1);
      return;
    }

    const query = match[2];
    const start = value.length - query.length - 1;

    setMentionStart(start);

    try {
      setMentionLoading(true);

      const res = await axiosInstance.get(
        `/comment/users?search=${encodeURIComponent(query)}`,
      );

      const users = Array.isArray(res.data) ? res.data : res.data.users || [];

      setMentionSuggestions(users.slice(0, 6));
    } catch (error) {
      console.error("Mention search error:", error);
      setMentionSuggestions([]);
    } finally {
      setMentionLoading(false);
    }
  };

  const selectMention = (mentionUser: MentionUser) => {
    if (!mentionTarget || mentionStart < 0) {
      return;
    }

    const mentionText = `@${mentionUser.username} `;

    if (mentionTarget === "comment") {
      setNewComment(
        (current) => current.substring(0, mentionStart) + mentionText,
      );
    }

    if (mentionTarget === "reply") {
      setReplyText(
        (current) => current.substring(0, mentionStart) + mentionText,
      );
    }

    if (mentionTarget === "edit") {
      setEditText(
        (current) => current.substring(0, mentionStart) + mentionText,
      );
    }

    setMentionSuggestions([]);
    setMentionTarget(null);
    setMentionStart(-1);
  };

  const renderCommentText = (text: string) => {
    const parts = text.split(/(@[a-zA-Z0-9_]+)/g);

    return parts.map((part, index) =>
      /^@[a-zA-Z0-9_]+$/.test(part) ? (
        <span
          key={index}
          className="text-blue-600 hover:text-blue-700 cursor-pointer"
        >
          {part}
        </span>
      ) : (
        <React.Fragment key={index}>{part}</React.Fragment>
      ),
    );
  };

  const extractMentions = (text: string) => {
    return [
      ...new Set(
        (text.match(/@[a-zA-Z0-9_]+/g) || []).map((mention) =>
          mention.substring(1).toLowerCase(),
        ),
      ),
    ];
  };

  // =========================
  // CREATE COMMENT
  // =========================
const handleSubmitComment = async () => {
  setCommentError("");

  const trimmedComment = newComment.trim();

  if (!user || !trimmedComment) {
    return;
  }

  if (trimmedComment.length > MAX_COMMENT_LENGTH) {
    return;
  }

  setIsSubmitting(true);

  try {
    const res = await axiosInstance.post("/comment/postcomment", {
      videoid: videoId,
      commentbody: trimmedComment,
      mentions: extractMentions(trimmedComment),
      altcha: captchaToken || undefined,
    });

    if (res.data.comment) {
      // Clear the input immediately
      setNewComment("");

      // CAPTCHA is one-time use
      setCaptchaToken("");
      setShowCaptcha(false);
      setCommentError("");

      // Update comments in background.
      // IMPORTANT: do NOT await this.
      loadComments().catch((error) => {
        console.error("Error refreshing comments:", error);
      });
    }
  } catch (error: any) {
    const status = error?.response?.status;
    const message =
      error?.response?.data?.message || "Unable to post comment.";

    if (status === 429) {
      setShowCaptcha(true);
      setCaptchaToken("");
      setCommentError(
        "You've posted too many comments. Please complete CAPTCHA to continue.",
      );
    } else if (
      status === 403 &&
      message.toLowerCase().includes("captcha")
    ) {
      setShowCaptcha(true);
      setCaptchaToken("");
      setCommentError(
        "CAPTCHA verification failed. Please complete CAPTCHA again.",
      );
    } else {
      setCommentError(message);
    }
  } finally {
    // ALWAYS stop Posting...
    setIsSubmitting(false);
  }
};

  // =========================
  // START EDIT
  // =========================
  const handleEdit = (comment: Comment) => {
    setEditingCommentId(comment._id);
    setEditText(comment.commentbody);
  };

  // =========================
  // UPDATE COMMENT
  // =========================
  const handleUpdateComment = async () => {
    const trimmedComment = editText.trim();

    if (!trimmedComment || !editingCommentId) {
      return;
    }

    if (trimmedComment.length > MAX_COMMENT_LENGTH) {
      return;
    }

    try {
      const currentComment = comments.find(
        (c) => String(c._id) === String(editingCommentId),
      );

      const res = await axiosInstance.post(
        `/comment/editcomment/${editingCommentId}`,
        {
          commentbody: trimmedComment,
          editVersion: currentComment?.editVersion ?? 0,
        },
      );

      const updatedComment = res.data;

      setComments((prev) =>
        prev.map((c) =>
          String(c._id) === String(editingCommentId)
            ? {
                ...c,
                commentbody: updatedComment?.commentbody || trimmedComment,
                isEdited: true,
                editedAt: new Date().toISOString(),
                editVersion: updatedComment?.editVersion,
              }
            : c,
        ),
      );

      setEditingCommentId(null);
      setEditText("");
    } catch (error: any) {
      console.error(
        "Error editing comment:",
        error?.response?.data?.message || error,
      );

      alert(error?.response?.data?.message || "Unable to edit comment");
    }
  };

  const handleTranslate = async (
    commentId: string,
    text: string,
    targetLanguage: string,
  ) => {
    setTranslatingId(commentId);

    setTranslationError((prev) => ({
      ...prev,
      [commentId]: "",
    }));
    setShowTranslateOptions(null);

    try {
      const res = await axiosInstance.post("/translation", {
        text,
        targetLanguage,
      });

      setTranslations((prev) => ({
        ...prev,
        [commentId]: res.data.translatedText,
      }));
    } catch (error: any) {
      setTranslationError((prev) => ({
        ...prev,
        [commentId]:
          error?.response?.data?.message ||
          "Translation failed. Please try again.",
      }));
    } finally {
      setTranslatingId(null);
    }
  };

  // =========================
  // DELETE COMMENT
  // =========================
  const handleDelete = async (id: string) => {
    try {
      const res = await axiosInstance.delete(`/comment/deletecomment/${id}`);

      if (res.data.comment) {
        setComments((prev) => prev.filter((c) => String(c._id) !== String(id)));

        setReactions((prev) => {
          const updated = { ...prev };
          delete updated[id];
          return updated;
        });
      }
    } catch (error: any) {
      console.error(
        "Error deleting comment:",
        error?.response?.data?.message || error,
      );
    }
  };

  // =========================
  // LIKE / DISLIKE
  // =========================
  const handleReaction = async (
    commentId: string,
    type: "like" | "dislike",
  ) => {
    if (!user) return;

    try {
      await axiosInstance.post(`/comment-reaction/${commentId}`, { type });

      await loadReactions(commentId);
    } catch (error: any) {
      console.error("Reaction error:", error?.response?.data?.message || error);
    }
  };

  // =========================
  // OPEN REPLY BOX
  // =========================
  const handleReply = (commentId: string) => {
    setReplyingTo(commentId);
    setReplyText("");
  };

  // =========================
  // SUBMIT REPLY
  // =========================
  const handleSubmitReply = async () => {
    setReplyError("");
    const trimmedReply = replyText.trim();

    if (!user || !replyingTo || !trimmedReply) {
      return;
    }

    if (trimmedReply.length > MAX_COMMENT_LENGTH) {
      return;
    }

    setIsReplying(true);

    try {
      // Find the comment being replied to
      const selectedComment = comments.find((c) => c._id === replyingTo);

      // If replying to a reply, use its
      // original parent instead.
      // This keeps replies at ONE visual level.
      const rootParentId = selectedComment?.parentCommentId || replyingTo;

      const res = await axiosInstance.post(`/comment/reply/${rootParentId}`, {
        videoid: videoId,
        commentbody: trimmedReply,
        mentions: extractMentions(trimmedReply),
      });

      if (res.data.comment) {
        const savedReply = res.data.data;

        const newReply: Comment = {
          _id: savedReply?._id || Date.now().toString(),

          videoid: videoId,

          userid: savedReply?.userid || user._id,

          commentbody: savedReply?.commentbody || trimmedReply,

          usercommented: savedReply?.usercommented || user.name || "Anonymous",

          username:
            savedReply?.username || user.username || user.name || "Anonymous",

          profileImage: savedReply?.profileImage || user.image || "",

          location: savedReply?.location || user.location || "Location not set",

          commentedon: savedReply?.commentedon || new Date().toISOString(),

          postedAt: savedReply?.postedAt || new Date().toISOString(),

          isEdited: false,

          createdAt: savedReply?.createdAt || new Date().toISOString(),

          // IMPORTANT:
          // Always store root parent
          parentCommentId: rootParentId,

          mentions: savedReply?.mentions || extractMentions(trimmedReply),
        };

        setComments((prev) => [...prev, newReply]);

        setReactions((prev) => ({
          ...prev,
          [newReply._id]: {
            likes: 0,
            dislikes: 0,
            userReaction: null,
          },
        }));
      }

      setReplyText("");
      setReplyingTo(null);
    } catch (error: any) {
      const message = error?.response?.data?.message || "Unable to post reply.";

      setReplyError(message);
    } finally {
      setIsReplying(false);
    }
  };

  // =========================
  // GET REPLIES
  // =========================
  const getReplies = (parentId: string) => {
    return comments.filter(
      (c) => String(c.parentCommentId) === String(parentId),
    );
  };

  // =========================
  // RENDER COMMENT
  // =========================
  const renderComment = (
    currentComment: Comment,
    level = 0,
  ): React.ReactNode => {
    const reaction = reactions[currentComment._id];

    const replies = getReplies(currentComment._id);

    return (
      <div
        key={currentComment._id}
        className={level > 0 ? "ml-10 mt-4 border-l pl-4" : ""}
      >
        <div className="flex gap-4">
          {/* AVATAR */}
          <Avatar className="w-10 h-10 shrink-0">
            <AvatarImage
              src={
                currentComment.profileImage ||
                "/placeholder.svg?height=40&width=40"
              }
            />

            <AvatarFallback>
              {(currentComment.username ||
                currentComment.usercommented ||
                "U")[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            {/* USER + TIME */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-medium text-sm">
                {currentComment.username ||
                  currentComment.usercommented ||
                  "Anonymous"}
              </span>

              <span className="text-xs text-gray-500">
                {formatDistanceToNow(
                  new Date(
                    currentComment.postedAt || currentComment.commentedon,
                  ),
                )}{" "}
                ago
              </span>

              {currentComment.location && (
  <span className="text-xs text-gray-500">
    • {currentComment.location}
  </span>
)}

              {currentComment.isEdited && (
                <span className="text-xs text-gray-400">• Edited</span>
              )}
            </div>

            {/* EDIT MODE */}
            {editingCommentId === currentComment._id ? (
              <div className="space-y-2">
                <Textarea
                  value={editText}
                  maxLength={MAX_COMMENT_LENGTH}
                  onChange={(e) => {
                    setEditText(e.target.value);
                    handleMentionInput(e.target.value, "edit");
                  }}
                />

                {mentionTarget === "edit" && mentionSuggestions.length > 0 && (
                  <div className="relative">
                    <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-lg">
                      {mentionSuggestions.map((mentionUser) => (
                        <button
                          key={mentionUser._id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectMention(mentionUser);
                          }}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-100"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={mentionUser.image || ""} />
                            <AvatarFallback>
                              {(mentionUser.username || "U")[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          <div>
                            <div className="text-sm font-medium text-black">
                              @{mentionUser.username}
                            </div>

                            {mentionUser.name &&
                              mentionUser.name !== mentionUser.username && (
                                <div className="text-xs text-gray-500">
                                  {mentionUser.name}
                                </div>
                              )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-right text-xs text-muted-foreground">
                  {editText.length}/{MAX_COMMENT_LENGTH}
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    onClick={handleUpdateComment}
                    disabled={!editText.trim()}
                  >
                    Save
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditingCommentId(null);
                      setEditText("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* COMMENT TEXT */}
                <p className="text-sm break-words">
                  {currentComment.status === "deleted" ? (
                    <span className="text-sm italic text-gray-500">
                      Comment deleted
                    </span>
                  ) : (
                    renderCommentText(currentComment.commentbody)
                  )}{" "}
                </p>

               

                {/* TRANSLATE */}
                {/* TRANSLATE */}
                {showTranslateOptions !== currentComment._id ? (
                  <button
                    type="button"
                    className="mt-2 text-xs text-blue-600 hover:underline"
                    onClick={() => setShowTranslateOptions(currentComment._id)}
                  >
                    Translate
                  </button>
                ) : (
                  <div className="flex items-center gap-2 mt-2">
                    <select
                      id={`language-${currentComment._id}`}
                      className="text-xs border rounded px-2 py-1"
                      defaultValue="en"
                    >
                      <option value="en">English</option>
                      <option value="hi">Hindi</option>
                      <option value="mr">Marathi</option>
                      <option value="ar">Arabic</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                    </select>

                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      disabled={translatingId === currentComment._id}
                      onClick={() => {
                        const select = document.getElementById(
                          `language-${currentComment._id}`,
                        ) as HTMLSelectElement;

                        handleTranslate(
                          currentComment._id,
                          currentComment.commentbody,
                          select.value,
                        );
                      }}
                    >
                      {translatingId === currentComment._id
                        ? "Translating..."
                        : "Translate"}
                    </button>
                  </div>
                )}

                {translations[currentComment._id] && (
                  <div className="mt-2 rounded-md bg-gray-50 p-2 text-sm">
                    <span className="block text-xs text-gray-500 mb-1">
                      Translated
                    </span>

                    {translations[currentComment._id]}
                  </div>
                )}

                {translationError[currentComment._id] && (
                  <p className="mt-1 text-xs text-red-500">
                    {translationError[currentComment._id]}
                  </p>
                )}

                {/* LIKE / DISLIKE / REPLY */}
                <div className="flex items-center gap-4 mt-3">
                  <button
                    type="button"
                    onClick={() => handleReaction(currentComment._id, "like")}
                    disabled={!user}
                    className={`text-sm ${
                      reaction?.userReaction === "like"
                        ? "font-semibold"
                        : "text-gray-500"
                    }`}
                  >
                    👍 {reaction?.likes || 0}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleReaction(currentComment._id, "dislike")
                    }
                    disabled={!user}
                    className={`text-sm ${
                      reaction?.userReaction === "dislike"
                        ? "font-semibold"
                        : "text-gray-500"
                    }`}
                  >
                    👎 {reaction?.dislikes || 0}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReply(currentComment._id)}
                    className="text-sm text-gray-500"
                  >
                    Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReportError("");
                      setReportSuccess("");
                      setReportingCommentId(currentComment._id);
                    }}
                    className="text-sm text-gray-500 hover:text-red-500"
                  >
                    Report
                  </button>
                  {reportingCommentId === currentComment._id && (
                    <div className="mt-3 rounded-lg border p-3">
                      <p className="text-sm font-medium mb-2">
                        Report this comment
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-100 whitespace-nowrap"
                          onClick={() =>
                            handleReport(currentComment._id, "spam")
                          }
                        >
                          Spam
                        </button>

                        <button
                          type="button"
                          className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-100 whitespace-nowrap"
                          onClick={() =>
                            handleReport(currentComment._id, "harassment")
                          }
                        >
                          Harassment
                        </button>

                        <button
                          type="button"
                          className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-100 whitespace-nowrap"
                          onClick={() =>
                            handleReport(currentComment._id, "offensive")
                          }
                        >
                          Offensive
                        </button>

                        <button
                          type="button"
                          className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-100 whitespace-nowrap"
                          onClick={() =>
                            handleReport(currentComment._id, "other")
                          }
                        >
                          Other
                        </button>

                        <button
                          type="button"
                          className="text-sm text-gray-500 px-2"
                          onClick={() => setReportingCommentId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* EDIT / DELETE */}
                {String(
                  typeof currentComment.userid === "object"
                    ? currentComment.userid?._id
                    : currentComment.userid,
                ) === String(user?._id) &&
                  canEditOrDelete(currentComment) && (
                    <div className="flex gap-3 mt-2 text-sm text-gray-500">
                      <button
                        type="button"
                        onClick={() => handleEdit(currentComment)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(currentComment._id)}
                      >
                        Delete
                      </button>
                    </div>
                  )}

                {/* REPLY BOX */}
                {replyingTo === currentComment._id && (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      placeholder="Write a reply..."
                      value={replyText}
                      maxLength={MAX_COMMENT_LENGTH}
                      onChange={(e) => {
                        setReplyText(e.target.value);
                        setReplyError("");
                        handleMentionInput(e.target.value, "reply");
                      }}
                    />

                    {replyError && (
                      <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                        {replyError}
                      </div>
                    )}

                    {mentionTarget === "reply" &&
                      mentionSuggestions.length > 0 && (
                        <div className="relative">
                          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-lg">
                            {mentionSuggestions.map((mentionUser) => (
                              <button
                                key={mentionUser._id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  selectMention(mentionUser);
                                }}
                                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-100"
                              >
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={mentionUser.image || ""} />
                                  <AvatarFallback>
                                    {(mentionUser.username ||
                                      "U")[0].toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>

                                <div>
                                  <div className="text-sm font-medium text-black">
                                    @{mentionUser.username}
                                  </div>

                                  {mentionUser.name &&
                                    mentionUser.name !==
                                      mentionUser.username && (
                                      <div className="text-xs text-gray-500">
                                        {mentionUser.name}
                                      </div>
                                    )}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                    <div className="text-right text-xs text-muted-foreground">
                      {replyText.length}/{MAX_COMMENT_LENGTH}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSubmitReply}
                        disabled={!replyText.trim() || isReplying}
                      >
                        {isReplying ? "Replying..." : "Reply"}
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyText("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* REPLIES */}
        {replies.length > 0 && (
          <div>{replies.map((reply) => renderComment(reply, level + 1))}</div>
        )}
      </div>
    );
  };

  // =========================
  // LOADING
  // =========================
  if (loading) {
    return <div>Loading comments...</div>;
  }

  // Only top-level comments
  const topLevelComments = comments.filter((c) => !c.parentCommentId);

  // =========================
  // COMMENT SORTING
  // =========================
  const sortedComments = [...topLevelComments].sort((a, b) => {
  if (sortOption === "newest") {
    return (
      new Date(b.createdAt || b.postedAt || b.commentedon).getTime() -
      new Date(a.createdAt || a.postedAt || a.commentedon).getTime()
    );
  }

  if (sortOption === "oldest") {
    return (
      new Date(a.createdAt || a.postedAt || a.commentedon).getTime() -
      new Date(b.createdAt || b.postedAt || b.commentedon).getTime()
    );
  }

  if (sortOption === "mostLiked") {
    return (reactions[b._id]?.likes || 0) - (reactions[a._id]?.likes || 0);
  }

  if (sortOption === "mostRelevant") {
    const getRelevanceScore = (comment: Comment) => {
      const likes = reactions[comment._id]?.likes || 0;
      const replies = getReplies(comment._id).length;

      const createdAt = new Date(
        comment.createdAt || comment.postedAt || comment.commentedon
      ).getTime();

      const ageInHours =
        (Date.now() - createdAt) / (1000 * 60 * 60);

      // Recent comments receive a higher score.
      const recencyScore = Math.max(0, 100 - ageInHours);

      return likes * 3 + replies * 2 + recencyScore;
    };

    return getRelevanceScore(b) - getRelevanceScore(a);
  }

  return 0;
});

  // =========================
  // UI
  // =========================
  return (
    <div className="space-y-6">
      {/* COUNT */}
      <h2 className="text-xl font-semibold">{comments.length} Comments</h2>
      {reportSuccess && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {reportSuccess}
        </div>
      )}

      {reportError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {reportError}
        </div>
      )}

      {/* SORT COMMENTS */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Sort by</span>

        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm bg-white text-black"
        >
          <option value="newest">Newest</option>
<option value="oldest">Oldest</option>
<option value="mostLiked">Most liked</option>
<option value="mostRelevant">Most relevant</option>
        </select>
      </div>

      {/* NEW COMMENT */}
      {user && (
        <div className="flex gap-4">
          <Avatar className="w-10 h-10">
            <AvatarImage src={user.image || ""} />

            <AvatarFallback>{user.name?.[0] || "U"}</AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-2">
            <Textarea
              placeholder="Add a comment..."
              value={newComment}
              maxLength={MAX_COMMENT_LENGTH}
              onChange={(e) => {
                setNewComment(e.target.value);
                setCommentError("");
                handleMentionInput(e.target.value, "comment");
              }}
              className="min-h-[80px] resize-none border-0 border-b-2 rounded-none focus-visible:ring-0"
            />

            {showCaptcha && (
              <div className="mb-3">
                {/* @ts-ignore - ALTCHA custom web component */}
                <altcha-widget
                  challenge="http://localhost:5000/captcha/challenge"
                  onverified={(event: any) => {
                    setCaptchaToken(event.detail.payload);
                  }}
                />
              </div>
            )}

            {commentError && (
              <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {commentError}
              </div>
            )}

            {mentionTarget === "comment" && mentionSuggestions.length > 0 && (
              <div className="relative">
                <div className="absolute z-50 mt-1 w-full max-w-sm overflow-hidden rounded-md border bg-white shadow-lg">
                  {mentionSuggestions.map((mentionUser) => (
                    <button
                      key={mentionUser._id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectMention(mentionUser);
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-100"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={mentionUser.image || ""} />
                        <AvatarFallback>
                          {(mentionUser.username || "U")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div>
                        <div className="text-sm font-medium text-black">
                          @{mentionUser.username}
                        </div>

                        {mentionUser.name &&
                          mentionUser.name !== mentionUser.username && (
                            <div className="text-xs text-gray-500">
                              {mentionUser.name}
                            </div>
                          )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="text-right text-xs text-muted-foreground">
              {newComment.length}/{MAX_COMMENT_LENGTH}
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => setNewComment("")}
                disabled={!newComment.trim() || isSubmitting}
              >
                Cancel
              </Button>

              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || isSubmitting}
              >
                {isSubmitting ? "Posting..." : "Comment"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* COMMENTS LIST */}
      <div className="space-y-6">
        {topLevelComments.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          sortedComments.map((currentComment) => renderComment(currentComment))
        )}
      </div>
    </div>
  );
};

export default Comments;
