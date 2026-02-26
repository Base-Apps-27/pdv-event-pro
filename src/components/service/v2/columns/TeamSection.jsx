/**
 * TeamSection.jsx — V2 team inputs per session.
 * Reads directly from Session entity fields.
 * Writes via useEntityWrite.writeSession.
 */

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TEAM_FIELDS } from "../constants/fieldMap";

export default function TeamSection({ session, accentColor = 'teal', onWriteSession }) {
  return (
    <Card className={`bg-${accentColor}-50 border-${accentColor}-300 border-2 print:hidden`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">EQUIPO {session.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {TEAM_FIELDS.map(f => (
          <TeamInput
            key={f.key}
            session={session}
            column={f.column}
            placeholder={f.label}
            onWriteSession={onWriteSession}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function TeamInput({ session, column, placeholder, onWriteSession }) {
  const value = session[column] || '';
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);

  return (
    <Input
      placeholder={placeholder}
      value={local}
      onChange={(e) => {
        setLocal(e.target.value);
        onWriteSession(session.id, column, e.target.value);
      }}
      className="text-xs"
    />
  );
}