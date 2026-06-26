import type { Appearance } from "@clerk/types";

export const clerkAppearance: Appearance = {
  variables: {
    colorBackground: "#0d0d1a",
    colorInputBackground: "#07070d",
    colorInputText: "#f0effe",
    colorText: "#f0effe",
    colorTextSecondary: "#9896b8",
    colorPrimary: "#7c6fee",
    colorDanger: "#ef4444",
    borderRadius: "8px",
    fontFamily: "inherit",
    fontSize: "14px",
    spacingUnit: "16px",
  },
  elements: {
    rootBox: "w-full",
    card: "w-full bg-[#0d0d1a] border border-[#1e1e38] rounded-xl shadow-[0_32px_80px_rgba(0,0,0,0.6)] overflow-hidden",
    headerTitle: "text-[#f0effe] text-[18px] font-bold tracking-tight",
    headerSubtitle: "text-[#9896b8] text-[13px]",
    socialButtonsBlockButton:
      "bg-[#07070d] border border-[#1e1e38] text-[#f0effe] hover:bg-[#111120] hover:border-[#2a2a48] transition-all rounded-lg",
    socialButtonsBlockButtonText: "text-[#f0effe] font-medium text-[13px]",
    formFieldInput:
      "bg-[#07070d] border border-[#1e1e38] text-[#f0effe] focus:border-[#7c6fee] focus:ring-0 rounded-lg text-[13px] placeholder:text-[#3a3858]",
    formFieldLabel: "text-[#9896b8] text-[12px] font-medium",
    formButtonPrimary:
      "bg-[#7c6fee] hover:bg-[#6355d4] text-white font-semibold rounded-lg transition-colors text-[14px] shadow-none",
    footerActionLink: "text-[#7c6fee] hover:text-[#9d8ff5] font-medium",
    footerActionText: "text-[#9896b8] text-[13px]",
    footer: "border-t border-[#1e1e38] bg-[#09091a]",
    footerAction: { display: "none" },
    dividerLine: "bg-[#1e1e38]",
    dividerText: "text-[#3a3858] text-[11px]",
    identityPreviewText: "text-[#f0effe]",
    identityPreviewEditButton: "text-[#7c6fee]",
    otpCodeFieldInput: "bg-[#07070d] border-[#1e1e38] text-[#f0effe]",
    formResendCodeLink: "text-[#7c6fee] hover:text-[#9d8ff5]",
    alertText: "text-[#9896b8] text-[12px]",
    badge: "bg-[#111120] text-[#9896b8] border-[#1e1e38]",
  },
};
