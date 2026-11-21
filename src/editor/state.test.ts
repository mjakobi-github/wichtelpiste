import { describe, expect, it } from 'vitest';
import { EditorState } from './state';
import { addElement } from './doc';
import { newLevel } from './template';
import type { Solution } from '../levels/solveRunner';

const sol = (n: number) => ({ strokes: [{ boost: false, pts: [[n, n], [n + 1, n]] as [number, number][] }] });

function twoStations(): EditorState {
  const l = addElement(newLevel(), 'station', { x: 1500, y: 500 }).level;
  const s: Solution = { areas: [sol(1), sol(2)] };
  return new EditorState({ ...l, dismounts: [...l.dismounts, { x: 2000, y: 500, w: 200, h: 100 }] }, s);
}

describe('EditorState', () => {
  it('Station löschen nimmt ihren Lösungsabschnitt mit, Rückgängig bringt beides zurück', () => {
    const st = twoStations();
    st.remove({ kind: 'station', index: 0 });
    expect(st.level.stations.length).toBe(1);
    expect(st.solution).toEqual({ areas: [sol(2)] });
    st.undo();
    expect(st.level.stations.length).toBe(2);
    expect(st.solution).toEqual({ areas: [sol(1), sol(2)] });
    st.redo();
    expect(st.solution).toEqual({ areas: [sol(2)] });
  });

  it('Umnummerieren tauscht Lösung mit, Rückgängig tauscht zurück', () => {
    const st = twoStations();
    st.renumber(0, 1);
    expect(st.solution).toEqual({ areas: [sol(2), sol(1)] });
    st.undo();
    expect(st.solution).toEqual({ areas: [sol(1), sol(2)] });
  });

  it('Aufzeichnung übernehmen ist ein Verlaufsschritt', () => {
    const st = new EditorState(newLevel(), null);
    st.mergeRecording({ level: st.level, solution: { areas: [sol(5)] }, solvedAreas: [true] });
    expect(st.solution).toEqual({ areas: [sol(5)] });
    st.undo();
    expect(st.solution).toBeNull();
  });

  it('Aufzeichnung zu einem anderen Level wird ignoriert', () => {
    const st = new EditorState(newLevel(), null);
    expect(st.mergeRecording({ level: { ...newLevel(), name: 'anders' }, solution: { areas: [sol(5)] }, solvedAreas: [true] })).toBe(0);
    expect(st.solution).toBeNull();
  });
});
