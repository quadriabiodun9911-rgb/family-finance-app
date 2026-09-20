import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Radius, Spacing } from '../theme/colors';
import { toISODate, shiftPeriod } from '../utils/date';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Props {
    period: string; // YYYY-MM currently displayed
    onPeriodChange: (period: string) => void;
    startDate: string | null;
    endDate: string | null;
    onSelectDate: (date: string) => void;
}

// A lightweight, dependency-free month calendar grid -- tap a day to pick
// it. The parent owns the start/end range state and the tap-to-extend-range
// logic (first tap sets start, second sets end, tapping again restarts),
// since that behavior differs by what the calendar is being used for.
export default function CalendarMonth({ period, onPeriodChange, startDate, endDate, onSelectDate }: Props) {
    const [year, month] = period.split('-').map(Number);
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    const cells: (string | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(toISODate(new Date(year, month - 1, d)));

    const isInRange = (date: string) => !!startDate && !!endDate && date >= startDate && date <= endDate;
    const isEndpoint = (date: string) => date === startDate || date === endDate;

    return (
        <View>
            <View style={styles.header}>
                <Pressable onPress={() => onPeriodChange(shiftPeriod(period, -1))} hitSlop={8}>
                    <Ionicons name="chevron-back" size={18} color={Colors.textMuted} />
                </Pressable>
                <Text style={styles.headerLabel}>{new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
                <Pressable onPress={() => onPeriodChange(shiftPeriod(period, 1))} hitSlop={8}>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </Pressable>
            </View>
            <View style={styles.weekRow}>
                {WEEKDAY_LABELS.map((w, i) => <Text key={i} style={styles.weekdayLabel}>{w}</Text>)}
            </View>
            <View style={styles.grid}>
                {cells.map((date, i) => (
                    <Pressable
                        key={i}
                        disabled={!date}
                        onPress={() => date && onSelectDate(date)}
                        style={[styles.cell, !!date && isInRange(date) && styles.cellInRange, !!date && isEndpoint(date) && styles.cellEndpoint]}
                    >
                        {date && <Text style={[styles.cellText, isEndpoint(date) && styles.cellTextEndpoint]}>{Number(date.slice(8, 10))}</Text>}
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: Spacing.sm },
    headerLabel: { color: Colors.text, fontSize: 14, fontWeight: '700' },
    weekRow: { flexDirection: 'row' },
    weekdayLabel: { flex: 1, textAlign: 'center', color: Colors.textFaint, fontSize: 11, fontWeight: '600', paddingBottom: 4 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
    cellInRange: { backgroundColor: Colors.primaryMuted },
    cellEndpoint: { backgroundColor: Colors.primary },
    cellText: { color: Colors.textMuted, fontSize: 13 },
    cellTextEndpoint: { color: '#fff', fontWeight: '700' },
});
