import React, { createContext, useContext, useState } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");

  const toggle = () => setDark(d => {
    localStorage.setItem("theme", !d ? "dark" : "light");
    return !d;
  });

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
