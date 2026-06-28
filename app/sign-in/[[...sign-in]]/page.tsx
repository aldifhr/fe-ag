import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-(--color-surface) shadow-none border border-(--color-border) rounded-xl",
            headerTitle: "text-(--color-text) text-xl font-semibold",
            headerSubtitle: "text-(--color-text-muted)",
            formFieldLabel: "text-(--color-text-secondary) text-sm",
            formFieldInput:
              "bg-(--color-bg) border border-(--color-border) text-(--color-text) rounded-lg focus:border-(--color-accent)",
            formButtonPrimary:
              "bg-(--color-accent) text-white rounded-lg hover:opacity-90 transition-opacity",
            footerActionLink: "text-(--color-accent) hover:text-(--color-accent-hover)",
            dividerLine: "bg-(--color-border)",
            dividerText: "text-(--color-text-muted)",
            socialButtonsBlockButton:
              "bg-(--color-bg) border border-(--color-border) text-(--color-text) hover:bg-(--color-surface-hover)",
            socialButtonsBlockButtonText: "text-(--color-text)",
            identityPreviewText: "text-(--color-text)",
            identityPreviewEditButton: "text-(--color-accent)",
          },
        }}
      />
    </div>
  );
}
