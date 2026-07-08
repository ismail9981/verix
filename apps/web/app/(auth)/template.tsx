"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/* A template (not a layout) re-mounts on every navigation within the group,
   so this gives each auth route a fresh Framer Motion enter transition as
   the user moves between sign in / register / forgot password. */
export default function AuthTemplate({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex w-full justify-center"
    >
      {children}
    </motion.div>
  );
}
