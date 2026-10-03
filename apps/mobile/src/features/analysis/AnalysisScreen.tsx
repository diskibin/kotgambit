import { createBoardState } from '@kotgambit/board-controller';
import {
  canCastle,
  editorReducer,
  fromFen,
  initialEditorState,
  toFen,
  type CastlingRight,
  type EditorPiece,
} from '@kotgambit/analysis-editor';
import { positionProblem, type PieceType, type PlacedPiece } from '@kotgambit/chess-core';
import { describePositionProblem } from '@kotgambit/coach';
import { apiErrorOf } from '@kotgambit/contracts';
import { useMemo, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAnalyzePositionMutation } from '../../app/api';
import { Banner } from '../../shared/ui/Banner';
import { BottomSheet } from '../../shared/ui/BottomSheet';
import { Button } from '../../shared/ui/Button';
import { Tabs } from '../../shared/ui/Tabs';
import { TextField } from '../../shared/ui/TextField';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, screenPadding, shashka, size, space, typography } from '../../theme/theme';
import { Board } from '../board/Board';
import { Piece } from '../board/Piece';
import { useBoardSize } from '../lessons/StepFrame';
import { Mascot } from '../mascot/Mascot';
import { AnalysisResult } from './AnalysisResult';

const PIECE_ORDER: readonly PieceType[] = ['k', 'q', 'r', 'b', 'n', 'p'];
const RIGHTS: readonly CastlingRight[] = ['wK', 'wQ', 'bK', 'bQ'];
const HTTP_UNAVAILABLE = 503;
const PIECE_CELL = 52;
const CAT = 56;

function statusOf(error: unknown): number | null {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status: unknown }).status)
    : null;
}

/** The square to point at for a problem the learner can fix by putting a piece there. */
function hintSquaresFor(
  problem: ReturnType<typeof positionProblem>,
  pieces: PlacedPiece[],
): string[] {
  if (!problem) return [];
  if (problem.kind === 'no-king') {
    const square = problem.color === 'w' ? 'e1' : 'e8';
    return pieces.some((piece) => piece.square === square) ? [] : [square];
  }
  if (problem.kind === 'pawn-on-edge') return [problem.square];
  return [];
}

/** The position editor with the engine's look at the position under it. */
export function AnalysisScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const boardSize = useBoardSize();
  const [editor, dispatch] = useReducer(editorReducer, undefined, initialEditorState);
  const [analyze, analysis] = useAnalyzePositionMutation();
  const [fenDraft, setFenDraft] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // The position that was sent: a look at an older one says nothing about this one
  const [analyzedFen, setAnalyzedFen] = useState<string | null>(null);

  const fen = toFen(editor);
  const problem = useMemo(() => positionProblem(fen), [fen]);
  const pieces = useMemo<PlacedPiece[]>(
    () => Object.entries(editor.pieces).map(([square, piece]) => ({ square, ...piece })),
    [editor.pieces],
  );
  const boardState = useMemo(
    () => createBoardState({ fen, orientation: editor.orientation }),
    [fen, editor.orientation],
  );

  const current = analyzedFen === fen;
  const result = current ? analysis.data : undefined;
  const loading = current && analysis.isLoading;
  const failed = current && analysis.isError;
  const serverError = failed ? apiErrorOf(analysis.error) : null;
  const busy = failed && statusOf(analysis.error) === HTTP_UNAVAILABLE;
  const draftInvalid = fenDraft !== null && fromFen(fenDraft) === null;
  const arrows = result?.best
    ? [
        {
          from: result.best.uci.slice(0, 2),
          to: result.best.uci.slice(2, 4),
          color: 'mint' as const,
        },
      ]
    : [];

  function run() {
    setAnalyzedFen(fen);
    void analyze(fen);
  }

  const toolIs = (piece: EditorPiece) =>
    editor.tool?.kind === 'piece' &&
    editor.tool.piece.color === piece.color &&
    editor.tool.piece.type === piece.type;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: screenPadding,
        paddingTop: insets.top + screenPadding,
        paddingBottom: insets.bottom + screenPadding,
        gap: space[3],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <Text accessibilityRole="header" style={[typography.h1, { color: colors.text, flex: 1 }]}>
          {t('analysis.title')}
        </Text>
        <Button variant="text" label={t('lesson.complete.home')} onPress={onBack} />
      </View>

      {result && !loading && <AnalysisResult analysis={result} />}
      {!result && !loading && !failed && (
        <Text
          style={[
            typography.body,
            {
              color: colors.textMuted,
              textAlign: 'center',
              padding: space[4],
              borderRadius: radius.card,
              borderWidth: 2,
              borderStyle: 'dashed',
              borderColor: colors.line,
            },
          ]}
        >
          {t('analysis.placeholder')}
        </Text>
      )}
      {loading && (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={t('analysis.loading.title')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[3],
            padding: space[3],
            borderRadius: radius.card,
            borderWidth: 2,
            borderColor: colors.line,
            backgroundColor: colors.surface,
          }}
        >
          <Mascot mood="thinking" size={CAT} dark={scheme === 'dark'} animate />
          <View style={{ flex: 1 }}>
            <Text style={[typography.h3, { color: colors.text }]}>
              {t('analysis.loading.title')}
            </Text>
            <Text style={[typography.small, { color: colors.text2 }]}>
              {t('analysis.loading.text')}
            </Text>
          </View>
        </View>
      )}
      {failed && !problem && (
        <View style={{ gap: space[2] }}>
          <Banner>
            {busy
              ? `${t('analysis.busy.title')}. ${t('analysis.busy.text')}`
              : (serverError?.message ?? t('analysis.loadError'))}
          </Banner>
          {busy && <Button label={t('analysis.busy.retry')} onPress={run} />}
        </View>
      )}

      <Board
        state={boardState}
        dispatch={() => undefined}
        pieces={pieces}
        onSquarePress={(square) => dispatch({ type: 'square/pressed', square })}
        hintSquares={hintSquaresFor(problem, pieces)}
        arrows={arrows}
        size={boardSize}
      />

      {problem && (
        <View
          accessibilityRole="alert"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[3],
            padding: space[3],
            borderRadius: radius.card,
            borderWidth: 2,
            borderColor: colors.coralBorder,
            backgroundColor: colors.coralTint,
          }}
        >
          <Mascot mood="oops" size={CAT} dark={scheme === 'dark'} />
          <View style={{ flex: 1 }}>
            <Text style={[typography.h3, { color: colors.coralText }]}>
              {t('analysis.invalid.title')}
            </Text>
            <Text style={[typography.small, { color: colors.text }]}>
              {describePositionProblem(problem)}
            </Text>
          </View>
        </View>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        <Button
          variant="secondary"
          label={t('analysis.editor.palette')}
          onPress={() => setPaletteOpen(true)}
        />
        <Button
          variant="secondary"
          label={t('analysis.editor.clear')}
          onPress={() => dispatch({ type: 'board/cleared' })}
        />
        <Button
          variant="secondary"
          label={t('analysis.editor.start')}
          onPress={() => dispatch({ type: 'board/reset' })}
        />
        <Button
          variant="secondary"
          label={t('analysis.editor.flip')}
          onPress={() => dispatch({ type: 'orientation/flipped' })}
        />
      </View>

      <TextField
        label={t('analysis.editor.fen')}
        value={fenDraft ?? fen}
        autoCapitalize="none"
        invalid={draftInvalid || problem !== null}
        {...(draftInvalid ? { error: t('analysis.editor.fenInvalid') } : {})}
        onChangeText={(text) => {
          // A complete FEN replaces the draft with the position it describes; until then the text stays
          const loaded = fromFen(text);
          if (loaded) {
            dispatch({ type: 'fen/loaded', fen: text });
            setFenDraft(null);
          } else setFenDraft(text);
        }}
      />

      <View style={{ gap: space[2] }}>
        <Text style={[typography.small, { color: colors.text }]}>{t('analysis.editor.turn')}</Text>
        <Tabs
          label={t('analysis.editor.turn')}
          tabs={[
            { id: 'w', label: t('analysis.editor.turnLabel.w') },
            { id: 'b', label: t('analysis.editor.turnLabel.b') },
          ]}
          value={editor.turn}
          onChange={(turn) => dispatch({ type: 'turn/set', turn })}
        />
      </View>

      <View accessibilityLabel={t('analysis.editor.castling')} style={{ gap: space[1] }}>
        <Text style={[typography.small, { color: colors.text }]}>
          {t('analysis.editor.castling')}
        </Text>
        {RIGHTS.map((right) => {
          const possible = canCastle(editor, right);
          const checked = editor.castling[right] && possible;
          return (
            <Pressable
              key={right}
              accessibilityRole="checkbox"
              accessibilityLabel={t(`analysis.editor.castlingLabel.${right}`)}
              accessibilityState={{ checked, disabled: !possible }}
              disabled={!possible}
              onPress={() => dispatch({ type: 'castling/toggled', right })}
              style={{
                minHeight: size.tapMin,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[3],
                opacity: possible ? 1 : 0.6,
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  borderWidth: shashka.border,
                  borderColor: colors.edge,
                  backgroundColor: checked ? colors.brand : colors.surface,
                }}
              />
              <Text style={[typography.body, { color: colors.text }]}>
                {t(`analysis.editor.castlingLabel.${right}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Button
        large
        busy={loading}
        disabled={problem !== null || loading}
        label={loading ? t('analysis.analyzing') : t('analysis.analyze')}
        onPress={run}
      />

      {paletteOpen && (
        <BottomSheet label={t('analysis.editor.pieces')} onClose={() => setPaletteOpen(false)}>
          <Text accessibilityRole="header" style={[typography.h2, { color: colors.text }]}>
            {t('analysis.editor.pieces')}
          </Text>
          <View
            accessibilityRole="radiogroup"
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}
          >
            {(['w', 'b'] as const).flatMap((color) =>
              PIECE_ORDER.map((type) => {
                const selected = toolIs({ color, type });
                return (
                  <Pressable
                    key={`${color}${type}`}
                    accessibilityRole="radio"
                    accessibilityLabel={t(`board.piece.${color}${type}`)}
                    accessibilityState={{ checked: selected }}
                    onPress={() =>
                      dispatch({
                        type: 'tool/chosen',
                        tool: selected ? null : { kind: 'piece', piece: { color, type } },
                      })
                    }
                    style={{
                      width: PIECE_CELL,
                      height: PIECE_CELL,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radius.control,
                      borderWidth: selected ? shashka.borderLarge : shashka.border,
                      borderColor: selected ? colors.brand : colors.line,
                      backgroundColor: selected ? colors.brandTint : colors.surface,
                    }}
                  >
                    <Piece color={color} type={type} size={PIECE_CELL - 12} />
                  </Pressable>
                );
              }),
            )}
          </View>
          <Pressable
            accessibilityRole="radio"
            accessibilityLabel={t('analysis.editor.eraser')}
            accessibilityState={{ checked: editor.tool?.kind === 'eraser' }}
            onPress={() =>
              dispatch({
                type: 'tool/chosen',
                tool: editor.tool?.kind === 'eraser' ? null : { kind: 'eraser' },
              })
            }
            style={{
              minHeight: size.tapMin,
              alignSelf: 'stretch',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.control,
              borderWidth: editor.tool?.kind === 'eraser' ? shashka.borderLarge : shashka.border,
              borderColor: editor.tool?.kind === 'eraser' ? colors.brand : colors.line,
              backgroundColor: editor.tool?.kind === 'eraser' ? colors.brandTint : colors.surface,
            }}
          >
            <Text style={[typography.button, { color: colors.text }]}>
              {t('analysis.editor.eraser')}
            </Text>
          </Pressable>
          <Button
            large
            label={t('analysis.editor.closePieces')}
            onPress={() => setPaletteOpen(false)}
          />
        </BottomSheet>
      )}
    </ScrollView>
  );
}
