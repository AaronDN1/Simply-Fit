"use client";

import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export function LandingAuthAction() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    getCurrentUser().then((user) => {
      if (active) setSignedIn(Boolean(user));
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <ButtonLink href={signedIn ? "/today" : "/login"} variant="ghost" size="sm">
      {signedIn ? "Log in" : "Sign in"}
    </ButtonLink>
  );
}
