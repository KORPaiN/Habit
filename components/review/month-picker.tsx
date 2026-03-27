"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { Locale } from "@/lib/locale";

type MonthPickerProps = {
  locale: Locale;
  currentYear: number;
  currentMonth: number;
  selectedYear: number;
  selectedMonth: number;
  previousHref: string;
  nextHref?: string;
};

export function MonthPicker({
  locale,
  currentYear,
  currentMonth,
  selectedYear,
  selectedMonth,
  previousHref,
  nextHref,
}: MonthPickerProps) {
  const router = useRouter();
  const [year, setYear] = useState(String(selectedYear));
  const [month, setMonth] = useState(String(selectedMonth + 1).padStart(2, "0"));

  const yearOptions = Array.from({ length: 3 }, (_, index) => currentYear - index);
  const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1);

  function goToMonth(nextYear: string, nextMonth: string) {
    startTransition(() => {
      router.push(`/review?month=${nextYear}-${nextMonth}` as Route);
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Select
          aria-label={locale === "ko" ? "연도 선택" : "Select year"}
          value={year}
          onChange={(event) => {
            const nextYear = event.target.value;
            setYear(nextYear);

            const nextMonthNumber = Number(month);
            const cappedMonth =
              Number(nextYear) === currentYear && nextMonthNumber > currentMonth + 1
                ? String(currentMonth + 1).padStart(2, "0")
                : month;

            if (cappedMonth !== month) {
              setMonth(cappedMonth);
            }

            goToMonth(nextYear, cappedMonth);
          }}
        >
          {yearOptions.map((option) => (
            <option key={option} value={option}>
              {locale === "ko" ? `${option}년` : option}
            </option>
          ))}
        </Select>
        <Select
          aria-label={locale === "ko" ? "월 선택" : "Select month"}
          value={month}
          onChange={(event) => {
            const nextMonth = event.target.value;
            setMonth(nextMonth);
            goToMonth(year, nextMonth);
          }}
        >
          {monthOptions.map((option) => {
            const isFuture = Number(year) === currentYear && option > currentMonth + 1;

            return (
              <option key={option} value={String(option).padStart(2, "0")} disabled={isFuture}>
                {locale === "ko" ? `${option}월` : option}
              </option>
            );
          })}
        </Select>
        <div className="hidden sm:block" />
      </div>
      <div className="flex items-center justify-center gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => router.push(previousHref as Route)}>
          {locale === "ko" ? "이전 달" : "Previous"}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={!nextHref} onClick={() => nextHref && router.push(nextHref as Route)}>
          {locale === "ko" ? "다음 달" : "Next"}
        </Button>
      </div>
    </div>
  );
}
