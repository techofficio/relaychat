import React from "react";

export function AppShell(props: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 24 }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>{props.title}</h1>
      </header>
      <main>{props.children}</main>
    </div>
  );
}
