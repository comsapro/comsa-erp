"use client";

import { useEffect, useState } from "react";
import { api, toQuery } from "@/lib/api/client";
import { COMMITMENT_STATUS_LABELS } from "@/domains/commitments/constants";

/**
 * Compromisos manuales del usuario (involucrado o creador) para pintarlos en
 * los calendarios el dia de entrega. Si no tiene permiso, regresa vacio.
 */
export function useCalendarCommitments({ from, to } = {}) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let alive = true;
    api
      .get(`/api/compromisos${toQuery({ scope: "mine", from, to })}`)
      .then((res) => {
        if (!alive) return;
        setRows(
          (res?.data || []).map((c) => ({
            id: `manual-${c.id}`,
            kind: "manual",
            commitmentId: c.id,
            calendarDate: c.dueDate,
            title: c.title,
            subtitle: `Compromiso · ${COMMITMENT_STATUS_LABELS[c.status] || c.status}${
              c.overdue ? " · Vencido" : ""
            } · ${c.participants.map((p) => p.user?.name).join(", ")}`,
            href: `/compromisos/${c.id}`,
          }))
        );
      })
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [from, to]);
  return rows;
}
