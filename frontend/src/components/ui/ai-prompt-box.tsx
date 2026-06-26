import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowUp, Paperclip, Square, X, StopCircle, Mic, Globe, BrainCog, FolderCode, ChevronDown, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Embedded CSS for minimal custom styles
const styles = `
  *:focus-visible {
    outline-offset: 0 !important;
    --ring-offset: 0 !important;
  }
  textarea::-webkit-scrollbar {
    width: 6px;
  }
  textarea::-webkit-scrollbar-track {
    background: transparent;
  }
  textarea::-webkit-scrollbar-thumb {
    background-color: #444444;
    border-radius: 3px;
  }
  textarea::-webkit-scrollbar-thumb:hover {
    background-color: #555555;
  }
`;

// Inject styles into document (client-side only)
if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles + `
    textarea {
      text-transform: none !important;
      font-family: ui-sans-serif, system-ui, sans-serif !important;
    }
  `;
  document.head.appendChild(styleSheet);
}

// Textarea Component
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex w-full rounded-md border-none bg-transparent px-3 py-2.5 text-[13px] text-zinc-900 dark:text-zinc-900 dark:text-gray-100 placeholder:text-zinc-500 dark:placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] resize-none scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-[#444444] scrollbar-track-transparent hover:scrollbar-thumb-zinc-400 dark:hover:scrollbar-thumb-[#555555] normal-case font-medium",
      className
    )}
    ref={ref}
    rows={1}
    {...props}
  />
));
Textarea.displayName = "Textarea";

// Tooltip Components
const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border border-zinc-200 dark:border-[#333333] bg-white dark:bg-white dark:bg-[#1F2023] px-3 py-1.5 text-sm text-zinc-900 dark:text-white shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// Dialog Components
const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-[90vw] md:max-w-[800px] translate-x-[-50%] translate-y-[-50%] gap-4 border border-zinc-200 dark:border-[#333333] bg-white dark:bg-[#1F2023] p-0 shadow-xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-2xl",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-full bg-zinc-100 dark:bg-[#2E3033]/80 p-2 hover:bg-zinc-200 dark:hover:bg-[#2E3033] transition-all">
        <X className="h-5 w-5 text-zinc-500 dark:text-gray-200 hover:text-zinc-900 dark:hover:text-white" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight text-gray-100", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variantClasses = {
      default: "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:hover:bg-white/80 dark:text-black",
      outline: "border border-zinc-200 dark:border-[#444444] bg-transparent hover:bg-zinc-100 dark:hover:bg-[#3A3A40]",
      ghost: "bg-transparent hover:bg-zinc-100 dark:hover:bg-[#3A3A40]",
    };
    const sizeClasses = {
      default: "h-10 px-4 py-2",
      sm: "h-8 px-3 text-sm",
      lg: "h-12 px-6",
      icon: "h-8 w-8 rounded-full aspect-[1/1]",
    };
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 text-[13px] leading-none",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// VoiceRecorder Component
interface VoiceRecorderProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: (duration: number) => void;
  visualizerBars?: number;
}
const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  isRecording,
  onStartRecording,
  onStopRecording,
  visualizerBars = 24,
}) => {
  const [time, setTime] = React.useState(0);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (isRecording) {
      onStartRecording();
      timerRef.current = setInterval(() => setTime((t) => t + 1), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      onStopRecording(time);
      setTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center w-full transition-all duration-300 py-2",
        isRecording ? "opacity-100" : "opacity-0 h-0 overflow-hidden"
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
        <span className="font-mono text-[10px] text-white/80">{formatTime(time)}</span>
      </div>
      <div className="w-full h-8 flex items-center justify-center gap-0.5 px-4 overflow-hidden">
        {[...Array(visualizerBars)].map((_, i) => (
          <div
            key={i}
            className="w-0.5 rounded-full bg-white/50 animate-pulse"
            style={{
              height: `${Math.max(20, Math.random() * 80)}%`,
              animationDelay: `${i * 0.05}s`,
              animationDuration: `${0.5 + Math.random() * 0.5}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

// ImageViewDialog Component
interface ImageViewDialogProps {
  imageUrl: string | null;
  onClose: () => void;
}
const ImageViewDialog: React.FC<ImageViewDialogProps> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;
  return (
    <Dialog open={!!imageUrl} onOpenChange={onClose}>
      <DialogContent className="p-0 border-none bg-transparent shadow-none max-w-[90vw] md:max-w-[800px]">
        <DialogTitle className="sr-only">Image Preview</DialogTitle>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative bg-[#1F2023] rounded-2xl overflow-hidden shadow-2xl"
        >
          <img
            src={imageUrl}
            alt="Full preview"
            className="w-full max-h-[80vh] object-contain rounded-2xl"
          />
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

// PromptInput Context and Components
interface PromptInputContextType {
  isLoading: boolean;
  value: string;
  setValue: (value: string) => void;
  maxHeight: number | string;
  onSubmit?: () => void;
  disabled?: boolean;
}
const PromptInputContext = React.createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 240,
  onSubmit: undefined,
  disabled: false,
});
function usePromptInput() {
  const context = React.useContext(PromptInputContext);
  if (!context) throw new Error("usePromptInput must be used within a PromptInput");
  return context;
}

interface PromptInputProps {
  isLoading?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  maxHeight?: number | string;
  onSubmit?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}
const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  (
    {
      className,
      isLoading = false,
      maxHeight = 240,
      value,
      onValueChange,
      onSubmit,
      children,
      disabled = false,
      onDragOver,
      onDragLeave,
      onDrop,
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(value || "");
    const handleChange = (newValue: string) => {
      setInternalValue(newValue);
      onValueChange?.(newValue);
    };
    return (
      <TooltipProvider>
        <PromptInputContext.Provider
          value={{
            isLoading,
            value: value ?? internalValue,
            setValue: onValueChange ?? handleChange,
            maxHeight,
            onSubmit,
            disabled,
          }}
        >
          <div
            ref={ref}
            className={cn(
              // Shape & spacing
              "rounded-2xl border p-2 relative overflow-hidden",
              // Base border — light/dark  (violet #8b5cf6)
              "border-[#8b5cf6]/20 dark:border-[#8b5cf6]/30",
              // Base background — glassmorphism
              "bg-white/80 dark:bg-[#0b0f1a]/80 backdrop-blur-xl",
              // Base glow — subtle and deep
              "shadow-[0_8px_32px_rgba(0,0,0,0.12)]",
              // Hover: vibrant neon edge
              "hover:border-[#8b5cf6]/50 dark:hover:border-[#8b5cf6]/60",
              "hover:shadow-[0_0_30px_rgba(139,92,246,0.15)] dark:hover:shadow-[0_0_40px_rgba(139,92,246,0.25)]",
              // Focus-within: intense neon glow + sharp border
              "focus-within:outline-none",
              "focus-within:border-[#8b5cf6]/80 dark:focus-within:border-[#8b5cf6]/90",
              "focus-within:ring-1 focus-within:ring-[#8b5cf6]/50",
              "focus-within:shadow-[0_0_50px_rgba(139,92,246,0.3)] dark:focus-within:shadow-[0_0_70px_rgba(139,92,246,0.5)]",
              // Inner light beam effect (top highlight)
              "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#8b5cf6]/40 before:to-transparent",
              // Loading: pulse animation
              isLoading && "animate-pulse border-[#8b5cf6] shadow-[0_0_40px_rgba(139,92,246,0.4)]",
              "transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)",
              className
            )}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {children}
          </div>
        </PromptInputContext.Provider>
      </TooltipProvider>
    );
  }
);
PromptInput.displayName = "PromptInput";

interface PromptInputTextareaProps {
  disableAutosize?: boolean;
  placeholder?: string;
}
const PromptInputTextarea: React.FC<PromptInputTextareaProps & React.ComponentProps<typeof Textarea>> = ({
  className,
  onKeyDown,
  disableAutosize = false,
  placeholder,
  ...props
}) => {
  const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (disableAutosize || !textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height =
      typeof maxHeight === "number"
        ? `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`
        : `min(${textareaRef.current.scrollHeight}px, ${maxHeight})`;
  }, [value, maxHeight, disableAutosize]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
    onKeyDown?.(e);
  };

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className={cn("text-[13px] leading-relaxed", className)}
      disabled={disabled}
      placeholder={placeholder}
      {...props}
    />
  );
};

interface PromptInputActionsProps extends React.HTMLAttributes<HTMLDivElement> {}
const PromptInputActions: React.FC<PromptInputActionsProps> = ({ children, className, ...props }) => (
  <div className={cn("flex items-center gap-2", className)} {...props}>
    {children}
  </div>
);

interface PromptInputActionProps extends React.ComponentProps<typeof Tooltip> {
  tooltip: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}
const PromptInputAction: React.FC<PromptInputActionProps> = ({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}) => {
  const { disabled } = usePromptInput();
  return (
    <Tooltip {...props}>
      <TooltipTrigger asChild disabled={disabled}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={cn("text-[10px] font-mono", className)}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
};

// Main PromptInputBox Component
interface PromptInputBoxProps {
  onSend?: (message: string, files?: File[]) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  value?: string;
}
export const PromptInputBox = React.forwardRef((props: PromptInputBoxProps, ref: React.Ref<HTMLDivElement>) => {
  const { onSend = () => {}, isLoading = false, placeholder = "Describe what you want to build...", className, value: externalValue = "" } = props;
  const [input, setInput] = React.useState(externalValue);
  const [files, setFiles] = React.useState<File[]>([]);

  // Update input when externalValue changes
  React.useEffect(() => {
    if (externalValue) setInput(externalValue);
  }, [externalValue]);
  const [filePreviews, setFilePreviews] = React.useState<{ [key: string]: string }>({});
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [isRecording, setIsRecording] = React.useState(false);
  const [showSearch, setShowSearch] = React.useState(false);
  const [showThink, setShowThink] = React.useState(false);
  const [showCanvas, setShowCanvas] = React.useState(false);
  const [mode, setMode] = React.useState<"fast" | "plan">("plan");
  const [model, setModel] = React.useState("auto");
  
  const uploadInputRef = React.useRef<HTMLInputElement>(null);
  const promptBoxRef = React.useRef<HTMLDivElement>(null);

  const handleToggleChange = (value: string) => {
    if (value === "search") {
      setShowSearch((prev) => !prev);
      setShowThink(false);
    } else if (value === "think") {
      setShowThink((prev) => !prev);
      setShowSearch(false);
    }
  };

  const handleCanvasToggle = () => setShowCanvas((prev) => !prev);

  const isImageFile = (file: File) => file.type.startsWith("image/");

  const processFile = (file: File) => {
    if (!isImageFile(file)) return;
    if (file.size > 10 * 1024 * 1024) return;
    setFiles([file]);
    const reader = new FileReader();
    reader.onload = (e) => setFilePreviews({ [file.name]: e.target?.result as string });
    reader.readAsDataURL(file);
  };

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter((file) => isImageFile(file));
    if (imageFiles.length > 0) processFile(imageFiles[0]);
  }, []);

  const handleRemoveFile = (index: number) => {
    const fileToRemove = files[index];
    if (fileToRemove && filePreviews[fileToRemove.name]) setFilePreviews({});
    setFiles([]);
  };

  const openImageModal = (imageUrl: string) => setSelectedImage(imageUrl);

  const MIN_CHARS = 500;
  const meetsMinChars = input.trim().length >= MIN_CHARS;

  const handleSubmit = () => {
    if (meetsMinChars || files.length > 0) {
      // Send the raw prompt — no prefix pollution
      onSend(input.trim(), files);
      setInput("");
      setFiles([]);
      setFilePreviews({});
    }
  };

  const handleStartRecording = () => {};

  const handleStopRecording = (duration: number) => {
    setIsRecording(false);
    onSend(`[Voice message - ${duration}s]`, []);
  };

  // hasContent is true only when the user has typed enough (500+ chars) or attached a file
  const hasContent = meetsMinChars || files.length > 0;

  return (
    <>
      <PromptInput
        value={input}
        onValueChange={setInput}
        isLoading={isLoading}
        onSubmit={handleSubmit}
        className={cn(
          "w-full bg-[var(--surface)] border-[var(--border)] transition-all duration-300 ease-in-out",
          isRecording && "border-red-500/70",
          className
        )}
        disabled={isLoading || isRecording}
        ref={ref || promptBoxRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {files.length > 0 && !isRecording && (
          <div className="flex flex-wrap gap-2 p-1 transition-all duration-300">
            {files.map((file, index) => (
              <div key={index} className="relative group shadow-sm ring-1 ring-[var(--border)] rounded-lg overflow-hidden">
                <div
                  className="w-12 h-12 overflow-hidden cursor-pointer"
                  onClick={() => openImageModal(filePreviews[file.name])}
                >
                  <img
                    src={filePreviews[file.name]}
                    alt={file.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile(index);
                  }}
                  className="absolute -top-1 -right-1 rounded-full bg-[var(--surface)] border border-[var(--border)] p-0.5 opacity-100 shadow-md translate-x-1/4 -translate-y-1/4"
                >
                  <X className="h-3 w-3 text-[var(--foreground)]" />
                </button>
              </div>
            ))}
          </div>
        )}


        <div
          className={cn(
            "transition-all duration-300",
            isRecording ? "h-0 overflow-hidden opacity-0" : "opacity-100"
          )}
        >
          <PromptInputTextarea
            placeholder={
              showSearch
                ? "Search web..."
                : showThink
                ? "Think deeply..."
                : showCanvas
                ? "Design on canvas..."
                : placeholder
            }
          />
          {/* Premium progress bar — shows only while user is typing toward 500 chars */}
          {input.length > 0 && !meetsMinChars && !isRecording && (
            <div className="px-3 pb-1.5">
              <div className="relative h-[3px] w-full rounded-full bg-zinc-800/60 overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    background:
                      input.length < 250
                        ? "linear-gradient(90deg, #f43f5e, #fb923c)"
                        : "linear-gradient(90deg, #f59e0b, #a78bfa)",
                  }}
                  animate={{ width: `${Math.min((input.length / MIN_CHARS) * 100, 100)}%` }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                />
              </div>
              <p className="mt-1 text-[10px] font-mono text-zinc-500 text-right">
                {MIN_CHARS - input.length} more chars to unlock
              </p>
            </div>
          )}
          {meetsMinChars && !isRecording && (
            <div className="px-3 pb-1.5">
              <div className="h-[3px] w-full rounded-full bg-gradient-to-r from-[#7c6fee] to-[#a78bfa] shadow-[0_0_8px_rgba(124,111,238,0.5)]" />
            </div>
          )}
        </div>

        {isRecording && (
          <VoiceRecorder
            isRecording={isRecording}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
          />
        )}

        <PromptInputActions className="flex items-center justify-between gap-2 p-1">
          <div
            className={cn(
              "flex items-center gap-0.5 transition-opacity duration-300",
              isRecording ? "opacity-0 invisible h-0" : "opacity-100 visible"
            )}
          >
            <PromptInputAction tooltip="ATTACH ASSETS">
              <button
                onClick={() => uploadInputRef.current?.click()}
                className="size-7 text-[var(--muted-foreground)] cursor-pointer flex items-center justify-center rounded-md hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                disabled={isRecording}
              >
                <Paperclip className="h-4 w-4" />
                <input
                  ref={uploadInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) processFile(e.target.files[0]);
                    if (e.target) e.target.value = "";
                  }}
                  accept="image/*"
                />
              </button>
            </PromptInputAction>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => handleToggleChange("search")}
                className={cn(
                  "rounded-md transition-all flex items-center gap-1.5 px-2 h-7 border",
                  showSearch
                    ? "bg-[var(--primary-accent)]/10 border-[var(--primary-accent)]/50 text-[var(--primary-accent)]"
                    : "bg-transparent border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                <Globe className="w-3.5 h-3.5" />
                <AnimatePresence>
                  {showSearch && (
                    <motion.span
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      className="text-[10px] font-semibold overflow-hidden whitespace-nowrap"
                    >
                      SEARCH
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              <button
                type="button"
                onClick={() => handleToggleChange("think")}
                className={cn(
                  "rounded-md transition-all flex items-center gap-1.5 px-2 h-7 border",
                  showThink
                    ? "bg-[var(--primary-accent)]/10 border-[var(--primary-accent)]/50 text-[var(--primary-accent)]"
                    : "bg-transparent border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                <BrainCog className="w-3.5 h-3.5" />
                <AnimatePresence>
                  {showThink && (
                    <motion.span
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      className="text-[10px] font-semibold overflow-hidden whitespace-nowrap"
                    >
                      THINK
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              <button
                type="button"
                onClick={handleCanvasToggle}
                className={cn(
                  "rounded-md transition-all flex items-center gap-1.5 px-2 h-7 border",
                  showCanvas
                    ? "bg-[var(--primary-accent)]/10 border-[var(--primary-accent)]/50 text-[var(--primary-accent)]"
                    : "bg-transparent border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                <FolderCode className="w-3.5 h-3.5" />
                <AnimatePresence>
                  {showCanvas && (
                    <motion.span
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      className="text-[10px] font-semibold overflow-hidden whitespace-nowrap"
                    >
                      CANVAS
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span
              className={cn(
                "text-[10px] font-mono mr-2 transition-colors duration-300 tabular-nums",
                input.length === 0
                  ? "text-zinc-600"
                  : meetsMinChars
                  ? "text-[var(--primary-accent)] font-semibold"
                  : input.length < 250
                  ? "text-rose-400"
                  : "text-amber-400"
              )}
              title={meetsMinChars ? "Ready to generate" : `Add ${MIN_CHARS - input.length} more characters to unlock generation`}
            >
              {input.length}/{MIN_CHARS}
            </span>
            {/* Model Selector — actual models */}
            <div className="relative group/model shrink-0">
              <select 
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="appearance-none bg-transparent border-none text-zinc-500 hover:text-[var(--primary-accent)] text-[10px] font-mono pr-5 py-1 focus:outline-none cursor-pointer transition-colors"
              >
                <option value="auto">auto (best available)</option>
                <option value="llama-3.3-70b">llama-3.3-70b</option>
                <option value="qwen3-coder">qwen3-coder</option>
                <option value="gemma-3-27b">gemma-3-27b</option>
              </select>
              <ChevronDown className="size-2 absolute right-0 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none transition-colors group-hover/model:text-[var(--primary-accent)]" />
            </div>

            <div className="flex items-center gap-2 pl-1 border-l border-zinc-800">
              <PromptInputAction
                tooltip={
                  isLoading
                    ? "ABORT"
                    : isRecording
                    ? "STOP"
                    : hasContent
                    ? "GENERATE PLAN"
                    : input.length > 0
                    ? `${MIN_CHARS - input.length} more chars needed`
                    : "VOICE"
                }
              >
                <button
                  onClick={() => {
                    if (isRecording) setIsRecording(false);
                    else if (hasContent) handleSubmit();
                    else setIsRecording(true);
                  }}
                  disabled={isLoading || (!isRecording && input.length > 0 && !meetsMinChars && files.length === 0)}
                  className={cn(
                    "size-7 rounded-lg flex items-center justify-center transition-all duration-200 shadow-sm",
                    isRecording
                      ? "bg-red-500 text-white animate-pulse"
                      : hasContent
                      ? "bg-[var(--primary-accent)] text-black hover:scale-105 shadow-[0_0_16px_rgba(124,111,238,0.5)]"
                      : input.length > 0 && !meetsMinChars
                      ? "bg-zinc-900 text-zinc-600 cursor-not-allowed"
                      : "bg-[#27272a] text-zinc-400 hover:text-white"
                  )}
                >
                  {isLoading ? (
                    <Square className="h-3 w-3 fill-current animate-pulse" />
                  ) : isRecording ? (
                    <StopCircle className="h-3.5 w-3.5" />
                  ) : hasContent ? (
                    <ArrowUp className="h-3.5 w-3.5 stroke-[2.5]" />
                  ) : input.length > 0 && !meetsMinChars ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                </button>
              </PromptInputAction>
            </div>
          </div>
        </PromptInputActions>
      </PromptInput>

      <ImageViewDialog imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />
    </>
  );
});
PromptInputBox.displayName = "PromptInputBox";
