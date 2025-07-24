
import React, { useState, useEffect, useCallback } from 'react';
import { GameState, Player, Board, Marks, Winner } from './types';
import { BOARD_SIZE, WINNING_COMBINATIONS } from './constants';
import BoardComponent from './components/Board';
import BingoHeader from './components/BingoHeader';
import ComputerTurnDialog from './components/ComputerTurnDialog';
import GameSummary from './components/GameSummary';
import { RobotIcon } from './components/icons/RobotIcon';
import { UserIcon } from './components/icons/UserIcon';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('SETUP');
  const [userBoard, setUserBoard] = useState<Board>(Array(BOARD_SIZE).fill(null));
  const [computerBoard, setComputerBoard] = useState<Board>([]);
  const [userMarks, setUserMarks] = useState<Marks>(Array(BOARD_SIZE).fill(false));
  const [computerMarks, setComputerMarks] = useState<Marks>(Array(BOARD_SIZE).fill(false));
  const [calledNumbers, setCalledNumbers] = useState<Set<number>>(new Set());
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [winner, setWinner] = useState<Winner>(null);
  const [nextNumberToPlace, setNextNumberToPlace] = useState<number>(1);
  const [computerMessage, setComputerMessage] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState<boolean>(false);
  const [userLines, setUserLines] = useState(0);
  const [computerLines, setComputerLines] = useState(0);
  const [userCompletedCombos, setUserCompletedCombos] = useState<number[]>([]);
  const [computerCompletedCombos, setComputerCompletedCombos] = useState<number[]>([]);

  const checkWinAndUpdate = useCallback(() => {
    const newUserCompletedCombos: number[] = [];
    WINNING_COMBINATIONS.forEach((combo, index) => {
      if (combo.every(cellIndex => userMarks[cellIndex])) {
        newUserCompletedCombos.push(index);
      }
    });
    setUserCompletedCombos(newUserCompletedCombos);
    setUserLines(newUserCompletedCombos.length);

    const newComputerCompletedCombos: number[] = [];
     WINNING_COMBINATIONS.forEach((combo, index) => {
      if (combo.every(cellIndex => computerMarks[cellIndex])) {
        newComputerCompletedCombos.push(index);
      }
    });
    setComputerCompletedCombos(newComputerCompletedCombos);
    setComputerLines(newComputerCompletedCombos.length);

    const userHasWon = newUserCompletedCombos.length >= 5;
    const computerHasWon = newComputerCompletedCombos.length >= 5;

    if (userHasWon || computerHasWon) {
        if (userHasWon && computerHasWon) {
            setWinner('DRAW');
        } else if (userHasWon) {
            setWinner('USER');
            // Save user's winning patterns for AI learning
            try {
                const patterns = JSON.parse(localStorage.getItem('userWinPatterns') || '{}');
                newUserCompletedCombos.forEach(comboIndex => {
                    patterns[comboIndex] = (patterns[comboIndex] || 0) + 1;
                });
                localStorage.setItem('userWinPatterns', JSON.stringify(patterns));
            } catch (e) {
                console.error("Could not update user win patterns", e);
            }
        } else if (computerHasWon) {
            setWinner('COMPUTER');
        }
        setGameState('GAME_OVER');
        setCurrentPlayer(null);
    }
  }, [userMarks, computerMarks]);

  const markNumber = useCallback((numberToMark: number) => {
    setCalledNumbers(prev => new Set(prev).add(numberToMark));

    const userIndex = userBoard.indexOf(numberToMark);
    if (userIndex !== -1) {
      setUserMarks(prev => {
        const newMarks = [...prev];
        newMarks[userIndex] = true;
        return newMarks;
      });
    }

    const computerIndex = computerBoard.indexOf(numberToMark);
    if (computerIndex !== -1) {
      setComputerMarks(prev => {
        const newMarks = [...prev];
        newMarks[computerIndex] = true;
        return newMarks;
      });
    }
  }, [userBoard, computerBoard]);

  const getComputerMove = useCallback((): number | null => {
    const findCriticalNumber = (targetMarks: Marks, targetBoard: Board): number | null => {
      for (const combo of WINNING_COMBINATIONS) {
        const markedIndices = combo.filter(i => targetMarks[i]);
        const unmarkedIndices = combo.filter(i => !targetMarks[i]);

        if (markedIndices.length === 4 && unmarkedIndices.length === 1) {
          const numberToCall = targetBoard[unmarkedIndices[0]];
          if (numberToCall && !calledNumbers.has(numberToCall)) {
            return numberToCall;
          }
        }
      }
      return null;
    };

    // 1. Offensive move: Check if computer can win
    const winningMove = findCriticalNumber(computerMarks, computerBoard);
    if (winningMove) return winningMove;

    // 2. Defensive move: Check if user is about to win and block them
    const blockingMove = findCriticalNumber(userMarks, userBoard);
    if (blockingMove) return blockingMove;

    // 3. Proactive blocking based on user's past winning patterns
    try {
        const patterns = JSON.parse(localStorage.getItem('userWinPatterns') || '{}');
        const sortedPatterns = Object.entries(patterns).sort(([, a], [, b]) => (b as number) - (a as number));

        for (const [comboIndexStr] of sortedPatterns) {
            const comboIndex = parseInt(comboIndexStr, 10);
            const combo = WINNING_COMBINATIONS[comboIndex];
            
            const markedIndices = combo.filter(i => userMarks[i]);
            const unmarkedIndices = combo.filter(i => !userMarks[i]);

            // If user has 3 marks in a preferred combo, block it.
            if (markedIndices.length === 3 && unmarkedIndices.length === 2) {
                for (const unmarkedIndex of unmarkedIndices) {
                    const numberToCall = userBoard[unmarkedIndex];
                    if (numberToCall && !calledNumbers.has(numberToCall)) {
                        return numberToCall;
                    }
                }
            }
        }
    } catch (e) {
        console.error("Could not parse user win patterns", e);
    }

    // 4. Random move: Pick a random available number from its board
    const availableNumbers = computerBoard.filter(num => num !== null && !calledNumbers.has(num as number));
    if (availableNumbers.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      return availableNumbers[randomIndex] as number;
    }
    
    return null;
  }, [computerBoard, computerMarks, userBoard, userMarks, calledNumbers]);

  useEffect(() => {
    if(calledNumbers.size > 0) {
      checkWinAndUpdate();
    }
  }, [userMarks, computerMarks, checkWinAndUpdate, calledNumbers.size]);

  useEffect(() => {
    if (gameState === 'PLAYING' && currentPlayer === 'COMPUTER' && !winner) {
      const computerMoveTimeout = setTimeout(() => {
        const chosenNumber = getComputerMove();
        
        if (chosenNumber !== null) {
          setComputerMessage(`My turn! I call number ${chosenNumber}...`);
          
          const markTimeout = setTimeout(() => {
            markNumber(chosenNumber);
            setComputerMessage(null);
            setCurrentPlayer('USER');
          }, 2000);

          return () => clearTimeout(markTimeout);
        }
      }, 1000);
      return () => clearTimeout(computerMoveTimeout);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlayer, gameState, winner, getComputerMove, markNumber]);

  const handleUserSetupClick = (index: number) => {
    if (gameState !== 'SETUP' || userBoard[index] !== null) return;

    if (nextNumberToPlace <= BOARD_SIZE) {
      const newUserBoard = [...userBoard];
      newUserBoard[index] = nextNumberToPlace;
      setUserBoard(newUserBoard);
      setNextNumberToPlace(prev => prev + 1);
    }
  };
  
  const handleRandomFill = () => {
    const shuffled = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    setUserBoard(shuffled);
    setNextNumberToPlace(BOARD_SIZE + 1);
  };

  const handleStartGame = () => {
    const shuffled = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    setComputerBoard(shuffled);
    setGameState('PLAYING');
    setCurrentPlayer('USER');
  };
  
  const handleNewGame = () => {
    setGameState('SETUP');
    setUserBoard(Array(BOARD_SIZE).fill(null));
    setComputerBoard([]);
    setUserMarks(Array(BOARD_SIZE).fill(false));
    setComputerMarks(Array(BOARD_SIZE).fill(false));
    setCalledNumbers(new Set());
    setCurrentPlayer(null);
    setWinner(null);
    setNextNumberToPlace(1);
    setComputerMessage(null);
    setShowSummary(false);
    setUserLines(0);
    setComputerLines(0);
    setUserCompletedCombos([]);
    setComputerCompletedCombos([]);
  };

  const handleUserPlayClick = (index: number) => {
    if (gameState !== 'PLAYING' || currentPlayer !== 'USER' || userMarks[index]) return;
    const number = userBoard[index];
    if (number !== null) {
      markNumber(number);
      if (!winner) {
          setCurrentPlayer('COMPUTER');
      }
    }
  };

  const isSetupComplete = nextNumberToPlace > BOARD_SIZE;

  const getWinnerText = () => {
    switch (winner) {
        case 'USER': return "🎉 PSYCH! You're the Winner! 🎉";
        case 'COMPUTER': return "🤖 You got PSYCH'd! The Computer Wins! 🤖";
        case 'DRAW': return "🤝 Total PSYCH-OUT! It's a Draw! 🤝";
        default: return '';
    }
  };
  
  const renderGameContent = () => {
    if (gameState === 'SETUP') {
      return (
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-cyan-400">Set Up Your Board</h1>
          <p className="mb-6 text-gray-300">Click the cells to place numbers 1 to 25, or fill randomly.</p>
          <BoardComponent
            board={userBoard}
            marks={userMarks}
            onCellClick={handleUserSetupClick}
            disabled={false}
            title="Your Board"
            gameState={gameState}
          />
          <div className="mt-8 flex justify-center items-center gap-4">
             <button
              onClick={handleRandomFill}
              className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-transform transform hover:scale-105"
            >
              Fill Randomly
            </button>
            {isSetupComplete && (
              <button
                onClick={handleStartGame}
                className="px-8 py-4 bg-green-500 text-white font-bold rounded-lg text-xl hover:bg-green-600 transition-transform transform hover:scale-105 animate-pulse"
              >
                Start Game
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="w-full flex flex-col items-center">
         {computerMessage && <ComputerTurnDialog message={computerMessage} />}
         {winner && (
            <div className="text-center my-4 p-4 rounded-lg bg-yellow-500 text-gray-900 w-full max-w-md">
                <h2 className="text-3xl font-bold">
                    {getWinnerText()}
                </h2>
                <button
                    onClick={() => setShowSummary(true)}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
                >
                    View Game Summary
                </button>
            </div>
        )}

        <div className="flex flex-col justify-center items-center w-full mt-4">
          <div className="flex flex-col items-center w-full lg:w-auto">
            <div className="flex items-center gap-3 mb-2">
              <UserIcon />
              <h2 className="text-2xl font-bold text-cyan-400">Your Board</h2>
            </div>
            <BingoHeader completedLines={userLines} />
            <BoardComponent
              board={userBoard}
              marks={userMarks}
              onCellClick={handleUserPlayClick}
              disabled={currentPlayer !== 'USER' || gameState === 'GAME_OVER'}
              gameState={gameState}
              completedComboIndices={userCompletedCombos}
              crossColor="text-cyan-400"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans">
      <header className="text-center mb-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">PSYCH-OUT</span> <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-yellow-500">BINGO</span>
        </h1>
        <p className="text-sm text-gray-400 -mt-1 sm:mt-0 mb-4">a game by Raghuram.</p>
         {gameState === 'PLAYING' && !winner && <p className="text-xl mt-2 text-gray-300">It's <span className={`font-bold ${currentPlayer === 'USER' ? 'text-cyan-400' : 'text-red-400'}`}>{currentPlayer}'s</span> turn!</p>}
      </header>
      <main className="w-full max-w-7xl flex-grow flex items-center justify-center">
        {showSummary ? (
           <GameSummary
              userBoard={userBoard}
              computerBoard={computerBoard}
              userMarks={userMarks}
              computerMarks={computerMarks}
              winner={winner}
              onClose={() => setShowSummary(false)}
              onNewGame={handleNewGame}
              userCompletedCombos={userCompletedCombos}
              computerCompletedCombos={computerCompletedCombos}
          />
        ) : (
          renderGameContent()
        )}
      </main>
    </div>
  );
};

export default App;