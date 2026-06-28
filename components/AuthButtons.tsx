"use client";

import { UserButton, SignInButton, useUser } from "@clerk/nextjs";

export default function AuthButtons() {
  const { isSignedIn } = useUser();

  if (isSignedIn) {
    return (
      <UserButton
        appearance={{
          elements: {
            avatarBox: "w-7 h-7 rounded-full",
            userButtonTrigger: "focus:shadow-none",
          },
        }}
      />
    );
  }

  return (
    <SignInButton mode="modal">
      <button className="px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors duration-150 bg-(--color-accent) text-white hover:opacity-90">
        Masuk
      </button>
    </SignInButton>
  );
}
