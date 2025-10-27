//
// Card class to represent cards with suits and values
//
class Card {
  constructor(value, suit) {
    this.value = value;
    this.suit = suit;
  }

  toString() {
    const values = { 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' };
    return `${values[this.value] || this.value} of ${this.suit}`;
  }

  getBlackjackValue() {
    if (this.value === 1) return 11; // Ace as 11
    return this.value > 10 ? 10 : this.value;
  }
}

// Global statistics
let stats = {
  totalGames: 0,
  wins: 0,
  losses: 0,
  pushes: 0
};

function updateStatsDisplay() {
  document.getElementById('totalGames').textContent = stats.totalGames;
  document.getElementById('wins').textContent = stats.wins;
  document.getElementById('losses').textContent = stats.losses;
  document.getElementById('pushes').textContent = stats.pushes;
  const winRate = stats.totalGames ? ((stats.wins / stats.totalGames) * 100).toFixed(2) : 0;
  document.getElementById('winRate').textContent = winRate;
}

function updateGameStats(gameState) {
  if (gameState.result) {
    stats.totalGames++;
    if (['player_wins', 'blackjack', 'dealer_bust'].includes(gameState.result)) {
      stats.wins++;
    } else if (gameState.result === 'push') {
      stats.pushes++;
    } else {
      stats.losses++;
    }
  } else if (gameState.multipleResults) {
    gameState.multipleResults.forEach((res) => {
      stats.totalGames++;
      if (res.result === 'player_wins') stats.wins++;
      else if (res.result === 'push') stats.pushes++;
      else stats.losses++;
    });
  }
  updateStatsDisplay();
}

function updateLiveBetDisplay() {
  const liveBetElement = document.getElementById('liveBetAmount');
  if (liveBetElement) {
    liveBetElement.textContent = game.currentBet ? game.currentBet : 0;
  }
}

//
// Deck class to create/shuffle/draw cards
//
class Deck {
  constructor() {
    this.reset();
  }
  reset() {
    const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
    this.cards = [];
    for (let suit of suits) {
      for (let value = 1; value <= 13; value++) {
        this.cards.push(new Card(value, suit));
      }
    }
    this.shuffle();
  }
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }
  draw() {
    if (this.cards.length === 0) this.reset();
    return this.cards.pop();
  }
}

//
// Single unified BlackjackGame class
//
class BlackjackGame {
  constructor() {
    this.currency = 10000;
    this.deck = new Deck();
    this.playerHand = [];
    this.dealerHand = [];
    this.currentBet = 0;
    this.gameStatus = 'idle';
    // For splits:
    this.playerHands = null;
    this.currentHandIndex = 0;
    this.splitCount = 0;
  }

  startNewHand(bet) {
    if (bet <= 0) throw new Error('Invalid bet amount');
    if (bet > this.currency) throw new Error("You cannot bet more than your balance!");
    this.currentBet = bet;
    this.currency -= bet;
    this.playerHands = null;
    this.currentHandIndex = 0;
    this.gameStatus = 'playing';

    this.playerHand = [this.deck.draw(), this.deck.draw()];
    this.dealerHand = [this.deck.draw(), this.deck.draw()];
    const playerTotal = this.calculateHand(this.playerHand);
    const dealerTotal = this.calculateHand(this.dealerHand);
    if (playerTotal === 21 || dealerTotal === 21) {
      this.gameStatus = 'complete';
      return this.resolveBlackjack(playerTotal, dealerTotal);
    }
    return {
      playerHand: this.playerHand,
      dealerHand: this.dealerHand,
      playerTotal,
      dealerUpCard: this.dealerHand[0].getBlackjackValue()
    };
  }

  resolveBlackjack(playerTotal, dealerTotal) {
    let result;
    if (playerTotal === 21 && dealerTotal === 21) {
      result = 'push';
      this.currency += this.currentBet;
    } else if (playerTotal === 21) {
      result = 'blackjack';
      this.currency += Math.floor(this.currentBet * 2.5);
    } else if (dealerTotal === 21) {
      result = 'dealer_blackjack';
    }
    return {
      result,
      playerHand: this.playerHand,
      dealerHand: this.dealerHand,
      playerTotal,
      dealerTotal
    };
  }

  hit() {
    if (this.gameStatus !== 'playing') throw new Error('Cannot hit: not your turn');
    if (this.playerHands) {
      const currentHand = this.playerHands[this.currentHandIndex];
      currentHand.push(this.deck.draw());
      const playerTotal = this.calculateHand(currentHand);
      if (playerTotal > 21) {
        if (this.currentHandIndex < this.playerHands.length - 1) {
          const justBustedIndex = this.currentHandIndex;
          this.currentHandIndex++;
          return {
            result: 'bust',
            bustedHand: currentHand,
            bustedHandIndex: justBustedIndex,
            activeHandIndex: this.currentHandIndex,
            playerHands: this.playerHands,
            dealerHand: [this.dealerHand[0], null]
          };
        } else {
          this.gameStatus = 'complete';
          return {
            result: 'bust',
            bustedHand: currentHand,
            bustedHandIndex: this.currentHandIndex,
            activeHandIndex: this.currentHandIndex,
            playerHands: this.playerHands,
            dealerHand: this.dealerHand
          };
        }
      } else {
        return {
          playerHands: this.playerHands,
          activeHandIndex: this.currentHandIndex,
          playerTotal,
          dealerHand: [this.dealerHand[0], null]
        };
      }
    } else {
      this.playerHand.push(this.deck.draw());
      const playerTotal = this.calculateHand(this.playerHand);
      if (playerTotal > 21) {
        this.gameStatus = 'complete';
        return {
          result: 'bust',
          playerHand: this.playerHand,
          dealerHand: this.dealerHand,
          playerTotal,
          dealerTotal: this.calculateHand(this.dealerHand)
        };
      }
      return {
        playerHand: this.playerHand,
        dealerHand: [this.dealerHand[0], null],
        playerTotal,
        dealerUpCard: this.dealerHand[0].getBlackjackValue()
      };
    }
  }

  stand() {
    try {
      const gameState = this.standInternal();
      if (this.gameStatus === 'dealer_turn') {
        const hiddenCards = document.querySelectorAll('#dealerArea .card.is-flipped');
        hiddenCards.forEach(card => card.classList.remove('is-flipped'));
        const dealerArea = document.getElementById('dealerArea');
        dealerArea.classList.add('dealer-animate');
        setTimeout(() => dealerArea.classList.remove('dealer-animate'), 500);
        setTimeout(() => {
          updateUI({ dealerHand: this.dealerHand });
          setTimeout(() => animateDealerTurn(), 500);
        }, 600);
      }
      if (gameState.result || gameState.multipleResults) {
        updateGameStats(gameState);
        endHand();
      }
      return gameState;
    } catch (error) {
      alert(error.message);
    }
  }

  standInternal() {
    if (this.playerHands) {
      if (this.currentHandIndex < this.playerHands.length - 1) {
        this.currentHandIndex++;
        return {
          message: 'Next hand',
          activeHandIndex: this.currentHandIndex,
          playerHands: this.playerHands,
          dealerHand: [this.dealerHand[0], null]
        };
      }
    }
    this.gameStatus = 'dealer_turn';
    return { dealerHand: this.dealerHand, playerHand: this.playerHand };
  }

  finalizeDealerTurn() {
    const dealerTotal = this.calculateHand(this.dealerHand);
    const playerTotal = this.calculateHand(this.playerHand);
    let result;
    if (dealerTotal > 21) {
      result = 'dealer_bust';
      this.currency += this.currentBet * 2;
    } else if (dealerTotal > playerTotal) {
      result = 'dealer_wins';
    } else if (playerTotal > dealerTotal) {
      result = 'player_wins';
      this.currency += this.currentBet * 2;
    } else {
      result = 'push';
      this.currency += this.currentBet;
    }
    this.gameStatus = 'complete';
    return {
      result,
      dealerHand: this.dealerHand,
      playerHand: this.playerHand,
      playerTotal,
      dealerTotal
    };
  }

  dealerNeedsCard() {
    return this.calculateHand(this.dealerHand) < 17;
  }

  dealerDrawOneCard() {
    this.dealerHand.push(this.deck.draw());
  }

  doubleDown() {
    if (this.currency < this.currentBet) throw new Error("Insufficient funds to double down.");
    if (this.gameStatus !== 'playing') throw new Error('Cannot double down: not your turn');
    this.currency -= this.currentBet;
    this.currentBet *= 2;
    if (this.playerHands) {
      let currentHand = this.playerHands[this.currentHandIndex];
      currentHand.push(this.deck.draw());
      const playerTotal = this.calculateHand(currentHand);
      if (playerTotal > 21) {
        this.gameStatus = 'complete';
        return {
          result: 'bust',
          bustedHand: currentHand,
          dealerHand: this.dealerHand,
          playerHands: this.playerHands,
          playerTotal
        };
      }
      return this.stand();
    } else {
      this.playerHand.push(this.deck.draw());
      const playerTotal = this.calculateHand(this.playerHand);
      if (playerTotal > 21) {
        this.gameStatus = 'complete';
        return {
          result: 'bust',
          playerHand: this.playerHand,
          dealerHand: this.dealerHand,
          playerTotal,
          dealerTotal: this.calculateHand(this.dealerHand)
        };
      }
      return this.stand();
    }
  }

  splitHand() {
    if (this.splitCount >= 3)
      throw new Error("Cannot split: Maximum splits reached.");
    if (this.gameStatus !== 'playing')
      throw new Error('Cannot split: not your turn');
    let handToSplit = this.playerHands ? this.playerHands[this.currentHandIndex] : this.playerHand;
    if (handToSplit.length !== 2 || handToSplit[0].getBlackjackValue() !== handToSplit[1].getBlackjackValue()) {
      throw new Error("Cannot split: Hand is not a pair.");
    }
    if (this.currency < this.currentBet)
      throw new Error("Insufficient funds to split.");
  
    // Deduct additional bet for the new hand
    this.currency -= this.currentBet;
  
    if (!this.playerHands) {
      this.playerHands = [[handToSplit[0]], [handToSplit[1]]];
    } else {
      this.playerHands.splice(this.currentHandIndex, 1, [handToSplit[0]], [handToSplit[1]]);
    }
    // Deal one additional card to each new hand
    this.playerHands[this.currentHandIndex].push(this.deck.draw());
    this.playerHands[this.currentHandIndex + 1].push(this.deck.draw());
    this.splitCount++;
    return {
      playerHands: this.playerHands,
      activeHandIndex: this.currentHandIndex,
      splitCount: this.splitCount
    };
  }
  

  calculateHand(hand) {
    let total = 0, aces = 0;
    for (let card of hand) {
      const value = card.getBlackjackValue();
      if (value === 11) aces++;
      total += value;
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    return total;
  }

  hasAce(hand) {
    return hand.some((card) => card.value === 1);
  }
  
  // (The getBasicStrategyMove method is not used in the calculator below.)
}

/* 
  Renders a card.
*/
function renderCardHTML(card, faceUp = true) {
  let cardValueName;
  switch (card.value) {
    case 1: cardValueName = 'ace'; break;
    case 11: cardValueName = 'jack'; break;
    case 12: cardValueName = 'queen'; break;
    case 13: cardValueName = 'king'; break;
    default: cardValueName = card.value;
  }
  const suitName = card.suit.toLowerCase();
  const frontSrc = `BJImages/${cardValueName}_of_${suitName}.png`;
  const backSrc = 'BJImages/back_of_card.png';
  return `
    <div class="card-container">
      <div class="card ${faceUp ? '' : 'is-flipped'}">
        <div class="card-face card-front">
          <img src="${frontSrc}" alt="${card.toString()}" />
        </div>
        <div class="card-face card-back">
          <img src="${backSrc}" alt="Card back" />
        </div>
      </div>
    </div>
  `;
}

/* 
  Animate card drawing.
*/
function animateDrawCard(targetSelector, callback) {
  const deckCard = document.getElementById('deckCard');
  const deckRect = deckCard.getBoundingClientRect();
  const clone = deckCard.cloneNode(true);
  clone.id = ''; 
  clone.style.position = 'absolute';
  clone.style.left = deckRect.left + 'px';
  clone.style.top = deckRect.top + 'px';
  clone.style.transition = 'all 0.5s ease';
  clone.style.zIndex = 9999;
  document.body.appendChild(clone);
  const targetEl = document.querySelector(targetSelector);
  const targetRect = targetEl.getBoundingClientRect();
  clone.offsetHeight;
  clone.style.left = (targetRect.left + 30) + 'px';
  clone.style.top  = (targetRect.top + 30) + 'px';
  clone.addEventListener('transitionend', () => {
    document.body.removeChild(clone);
    if (callback) callback();
  });
}

//
// UI event handlers
//
let game = null;

function updateNavButtons() {
  const calcBtn = document.getElementById('calculatorBtn');
  calcBtn.style.display = (game && game.gameStatus === 'playing') ? 'none' : 'inline-block';
}

/* 
  Update UI including conditional display of the split button.
*/
function updateUI(gameState) {
  if (!gameState) return;
  const playerArea = document.getElementById('playerArea');
  const dealerArea = document.getElementById('dealerArea');
  const resultArea = document.getElementById('gameResult');
  const currencyDisplay = document.getElementById('currency');

  if (gameState.playerHands) {
    let handsHtml = gameState.playerHands.map((hand, idx) => {
      const total = game.calculateHand(hand);
      const isActive = (gameState.activeHandIndex === idx) ? 'active-hand' : '';
      const cardsHtml = hand.map(c => renderCardHTML(c, true)).join('');
      return `<div class="${isActive}"><strong>Hand ${idx + 1} (Total: ${total}):</strong><br>${cardsHtml}</div>`;
    }).join('<br>');
    playerArea.innerHTML = `<h3>Your Split Hands:</h3>${handsHtml}`;
  } else if (gameState.playerHand) {
    const total = gameState.playerTotal || game.calculateHand(gameState.playerHand);
    const cardsHtml = gameState.playerHand.map(c => renderCardHTML(c, true)).join('');
    playerArea.innerHTML = `<h3>Your Hand (Total: ${total}):</h3>${cardsHtml}`;
  }

  if (gameState.dealerHand) {
    let dealerCardsHtml = gameState.dealerHand.map((card, index) => {
      const faceUp = index === 0 || (game.gameStatus !== 'playing');
      return renderCardHTML(card, faceUp);
    }).join('');
    const dealerTotal = (game.gameStatus !== 'playing' && gameState.dealerTotal !== undefined) ? ` (Total: ${gameState.dealerTotal})` : '';
    dealerArea.innerHTML = `<h3>Dealer's Hand${dealerTotal}</h3>${dealerCardsHtml}`;
  }

  const resultMessages = {
    bust: `You busted and lost $${game.currentBet}.`,
    dealer_bust: `Dealer busted! You won $${game.currentBet}.`,
    dealer_wins: `Dealer won! You lost $${game.currentBet}.`,
    player_wins: `You won $${game.currentBet}!`,
    push: `It's a push. Your $${game.currentBet} was returned.`,
    blackjack: `Blackjack! You won $${Math.floor(game.currentBet * 1.5)}.`,
    dealer_blackjack: `Dealer has Blackjack! You lost $${game.currentBet}.`
  };

  if (gameState.multipleResults) {
    const dealerTotal = gameState.multipleResults[0].dealerTotal;
    let finalText = `<h3>Final Results</h3><p>Dealer's Total: <strong>${dealerTotal}</strong></p>`;
    gameState.multipleResults.forEach((res, idx) => {
      const friendlyText = resultMessages[res.result] || res.result;
      finalText += `<p><strong>Hand ${idx + 1}:</strong> ${friendlyText} (Your Total: ${res.playerTotal})</p>`;
    });
    resultArea.innerHTML = finalText;
  } else if (gameState.result) {
    const friendlyText = resultMessages[gameState.result] || gameState.result;
    const dealerTotal = (gameState.dealerTotal !== undefined) ? gameState.dealerTotal : '???';
    const playerTotal = (gameState.playerTotal !== undefined) ? gameState.playerTotal : '???';
    resultArea.innerHTML = `<h3>Final Result</h3><p>${friendlyText}</p><p>Dealer's Total: <strong>${dealerTotal}</strong>, Your Total: <strong>${playerTotal}</strong></p>`;
  } else {
    resultArea.innerHTML = '';
  }

  currencyDisplay.textContent = game.currency;
  updateLiveBetDisplay();
  updateNavButtons();
}

// Force the Split button to be visible at all times
splitButton.style.display = 'inline-block';


function animateDealerTurn() {
  if (game.dealerNeedsCard()) {
    animateDrawCard('#dealerArea', () => {
      game.dealerDrawOneCard();
      updateUI({ dealerHand: game.dealerHand });
      const dealerCards = document.querySelectorAll("#dealerArea .card");
      if (dealerCards.length > 0) {
        const lastCard = dealerCards[dealerCards.length - 1];
        lastCard.classList.add("dealer-card-animate");
        setTimeout(() => lastCard.classList.remove("dealer-card-animate"), 500);
      }
      animateDealerTurn();
    });
  } else {
    const finalState = game.finalizeDealerTurn();
    updateUI(finalState);
    updateGameStats(finalState);
    endHand();
  }
}

function animateInitialDeal(initialState) {
  document.getElementById('playerArea').innerHTML = '';
  document.getElementById('dealerArea').innerHTML = '';
  const sequence = [
    { target: '#playerArea', offsetX: 30, offsetY: 30 },
    { target: '#dealerArea', offsetX: 30, offsetY: 30 },
    { target: '#playerArea', offsetX: 70, offsetY: 30 },
    { target: '#dealerArea', offsetX: 70, offsetY: 30 }
  ];
  function dealNext(i) {
    if (i >= sequence.length) { updateUI(initialState); return; }
    const deckCard = document.getElementById('deckCard');
    const deckRect = deckCard.getBoundingClientRect();
    const target = sequence[i];
    const clone = deckCard.cloneNode(true);
    clone.style.position = 'absolute';
    clone.style.left = deckRect.left + 'px';
    clone.style.top = deckRect.top + 'px';
    clone.style.transition = 'all 0.5s ease';
    clone.style.zIndex = 9999;
    document.body.appendChild(clone);
    clone.offsetHeight;
    const targetEl = document.querySelector(target.target);
    const targetRect = targetEl.getBoundingClientRect();
    clone.style.left = (targetRect.left + target.offsetX) + 'px';
    clone.style.top  = (targetRect.top + target.offsetY) + 'px';
    clone.addEventListener('transitionend', () => {
      document.body.removeChild(clone);
      setTimeout(() => dealNext(i + 1), 100);
    });
  }
  dealNext(0);
}

function startGame() {
  document.getElementById('playerArea').innerHTML = '';
  document.getElementById('dealerArea').innerHTML = '';
  document.getElementById('gameResult').innerHTML = '';
  if (!game) {
    game = new BlackjackGame();
  } else {
    game.deck.reset();
    game.playerHand = [];
    game.dealerHand = [];
    game.gameStatus = 'idle';
  }
  document.getElementById('gameArea').style.display = 'block';
  document.getElementById('betArea').style.display = 'block';
  document.getElementById('actionButtons').style.display = 'none';
  const deckCard = document.getElementById('deckCard');
  if (deckCard) {
    deckCard.innerHTML = renderCardHTML(new Card(1, 'Hearts'), false);
  }
}

function playHand() {
  if (!game) { alert('Please start a new game first'); return; }
  const betInput = document.getElementById('bet');
  if (!betInput || !betInput.value) { alert('Please enter a bet amount'); return; }
  const bet = parseInt(betInput.value);
  try {
    const gameState = game.startNewHand(bet);
    document.getElementById('actionButtons').style.display = 'block';
    document.getElementById('betArea').style.display = 'none';
    animateInitialDeal(gameState);
    if (gameState.result) { endHand(); }
  } catch (error) { alert(error.message); }
}

function hit() {
  if (!game) { alert('Please start a new game first'); return; }
  if (game.gameStatus !== 'playing') { alert('Please place a bet to start playing'); return; }
  try {
    animateDrawCard('#playerArea', () => {
      const gameState = game.hit();
      updateUI(gameState);
      if (gameState.result) { updateGameStats(gameState); endHand(); }
    });
  } catch (error) { alert(error.message); }
}

function stand() {
  try { game.stand(); } catch (error) { alert(error.message); }
}

function handleDoubleDown() {
  animateDrawCard('#playerArea', () => {
    try {
      const result = game.doubleDown();
      updateUI(result);
      if (result && (result.result || result.multipleResults)) {
        updateGameStats(result);
        endHand();
      } else if (game.gameStatus === 'dealer_turn') {
        updateUI({ dealerHand: game.dealerHand });
        setTimeout(() => animateDealerTurn(), 500);
      }
    } catch (error) { alert(error.message); }
  });
}

function handleSplit() {
  try {
    const splitResult = game.splitHand();
    updateUI({ playerHands: game.playerHands, activeHandIndex: game.currentHandIndex });
  } catch (error) { alert(error.message); }
}

function endHand() {
  document.getElementById('actionButtons').style.display = 'none';
  document.getElementById('betArea').style.display = 'none';
  document.getElementById('strategyAdvice').style.display = 'none';
}

/* 
  --- Improved Strategy Calculator Functions ---
  Each function returns an object with a recommended move and details.
*/

function getPairStrategy(cardValue, dealerCard) {
  let details = '';
  if (cardValue === 11) {
    details = 'Always split Aces.';
    return { move: 'split', details };
  } else if (cardValue === 10) {
    details = 'Never split 10s.';
    return { move: 'stand', details };
  } else if (cardValue === 9) {
    if (dealerCard === 7 || dealerCard === 10 || dealerCard === 11) {
      details = 'Stand on pair of 9s against dealer ' + dealerCard + '.';
      return { move: 'stand', details };
    } else {
      details = 'Split 9s against dealer ' + dealerCard + '.';
      return { move: 'split', details };
    }
  } else if (cardValue === 8) {
    details = 'Always split 8s.';
    return { move: 'split', details };
  } else if (cardValue === 7) {
    if (dealerCard <= 7) {
      details = 'Split 7s against dealer ' + dealerCard + '.';
      return { move: 'split', details };
    } else {
      details = 'Hit on pair of 7s against dealer ' + dealerCard + '.';
      return { move: 'hit', details };
    }
  } else if (cardValue === 6) {
    if (dealerCard <= 6) {
      details = 'Split 6s against dealer ' + dealerCard + '.';
      return { move: 'split', details };
    } else {
      details = 'Hit on pair of 6s against dealer ' + dealerCard + '.';
      return { move: 'hit', details };
    }
  } else if (cardValue === 5) {
    if (dealerCard <= 9) {
      details = 'Double on pair of 5s.';
      return { move: 'double', details };
    } else {
      details = 'Hit on pair of 5s against dealer ' + dealerCard + '.';
      return { move: 'hit', details };
    }
  } else if (cardValue === 4) {
    if (dealerCard === 5 || dealerCard === 6) {
      details = 'Split 4s against dealer ' + dealerCard + '.';
      return { move: 'split', details };
    } else {
      details = 'Hit on pair of 4s against dealer ' + dealerCard + '.';
      return { move: 'hit', details };
    }
  } else if (cardValue === 3 || cardValue === 2) {
    if (dealerCard <= 7) {
      details = 'Split ' + cardValue + 's against dealer ' + dealerCard + '.';
      return { move: 'split', details };
    } else {
      details = 'Hit on pair of ' + cardValue + 's against dealer ' + dealerCard + '.';
      return { move: 'hit', details };
    }
  }
  details = 'Hit by default.';
  return { move: 'hit', details };
}

function getSoftTotalStrategy(total, dealerCard) {
  let details = '';
  if (total >= 19) {
    details = 'Soft ' + total + ' is strong – stand (or double on 19 vs dealer 6).';
    return { move: (total === 19 && dealerCard === 6) ? 'double' : 'stand', details };
  }
  if (total === 18) {
    if (dealerCard >= 9) {
      details = 'Dealer shows ' + dealerCard + ' – hit on soft 18.';
      return { move: 'hit', details };
    } else if (dealerCard >= 7) {
      details = 'Dealer shows ' + dealerCard + ' – stand on soft 18.';
      return { move: 'stand', details };
    } else {
      details = 'Dealer shows ' + dealerCard + ' – double on soft 18.';
      return { move: 'double', details };
    }
  }
  if (total === 17) {
    details = (dealerCard >= 3 && dealerCard <= 6) ? 'Double on soft 17.' : 'Hit on soft 17.';
    return { move: (dealerCard >= 3 && dealerCard <= 6) ? 'double' : 'hit', details };
  }
  if (total <= 16) {
    details = (dealerCard >= 4 && dealerCard <= 6) ? 'Double on soft ' + total + '.' : 'Hit on soft ' + total + '.';
    return { move: (dealerCard >= 4 && dealerCard <= 6) ? 'double' : 'hit', details };
  }
}

function getHardTotalStrategy(total, dealerCard) {
  let details = '';
  if (total >= 17) {
    details = 'Hard ' + total + ' is high – stand.';
    return { move: 'stand', details };
  }
  if (total >= 13 && total <= 16) {
    details = (dealerCard >= 7) ? 'Dealer shows high card – hit on hard ' + total + '.' : 'Dealer shows low card – stand on hard ' + total + '.';
    return { move: (dealerCard >= 7) ? 'hit' : 'stand', details };
  }
  if (total === 12) {
    details = (dealerCard >= 4 && dealerCard <= 6) ? 'Stand on hard 12.' : 'Hit on hard 12.';
    return { move: (dealerCard >= 4 && dealerCard <= 6) ? 'stand' : 'hit', details };
  }
  if (total === 11) {
    details = 'Double on hard 11.';
    return { move: 'double', details };
  }
  if (total === 10) {
    details = (dealerCard >= 10) ? 'Hit on hard 10.' : 'Double on hard 10.';
    return { move: (dealerCard >= 10) ? 'hit' : 'double', details };
  }
  if (total === 9) {
    details = (dealerCard >= 3 && dealerCard <= 6) ? 'Double on hard 9.' : 'Hit on hard 9.';
    return { move: (dealerCard >= 3 && dealerCard <= 6) ? 'double' : 'hit', details };
  }
  details = 'Hit on hard ' + total + '.';
  return { move: 'hit', details };
}

function getStrategyHTML(move, handType, details) {
  const moveColors = {
    'hit': '#e74c3c',
    'stand': '#2ecc71',
    'double': '#f1c40f',
    'split': '#3498db'
  };
  const moveExplanations = {
    'hit': 'Take another card',
    'stand': 'Keep your current hand',
    'double': 'Double your bet and take one more card',
    'split': 'Split your pair into two hands'
  };
  return `
    <div style="padding: 15px; background: rgba(0,0,0,0.1); border-radius: 8px;">
      <h3 style="margin-bottom: 10px;">Strategic Advice</h3>
      <p>Hand Type: <strong>${handType}</strong></p>
      <p style="margin: 10px 0;">Recommended Move: 
        <span style="color: ${moveColors[move]}; font-weight: bold; text-transform: uppercase;">
          ${move}
        </span>
      </p>
      <p style="font-size: 0.9em; opacity: 0.9;">${moveExplanations[move]}</p>
      ${ details ? `<p style="font-size: 0.8em; color: #bdc3c7;">Details: ${details}</p>` : '' }
    </div>
  `;
}

function calculateBestMove() {
  const card1 = parseInt(document.getElementById('playerCard1').value);
  const card2 = parseInt(document.getElementById('playerCard2').value);
  const dealerCard = parseInt(document.getElementById('dealerCard').value);
  const bestMoveElem = document.getElementById('bestMove');
  if (!card1 || !card2 || !dealerCard) {
    bestMoveElem.innerHTML = '<p style="color: #e74c3c;">Please select all cards.</p>';
    return;
  }
  let total = card1 + card2;
  const hasAce = (card1 === 11 || card2 === 11);
  const isPair = (card1 === card2);
  if (isPair) {
    const { move, details } = getPairStrategy(card1, dealerCard);
    bestMoveElem.innerHTML = getStrategyHTML(move, 'Pair of ' + card1 + 's', details);
    return;
  }
  if (hasAce) {
    if (total > 21) total -= 10;
    const { move, details } = getSoftTotalStrategy(total, dealerCard);
    bestMoveElem.innerHTML = getStrategyHTML(move, 'Soft ' + total, details);
    return;
  }
  const { move, details } = getHardTotalStrategy(total, dealerCard);
  bestMoveElem.innerHTML = getStrategyHTML(move, 'Hard ' + total, details);
}

function updatePlayerTotal() {
  const card1 = parseInt(document.getElementById('playerCard1').value) || 0;
  const card2 = parseInt(document.getElementById('playerCard2').value) || 0;
  if (card1 && card2) {
    let total = card1 + card2;
    let hasAce = card1 === 11 || card2 === 11;
    if (total > 21 && hasAce) total -= 10;
    if (document.getElementById('dealerCard').value) {
      calculateBestMove();
      window.calculateBestMove = calculateBestMove;
    }
  }
}

function showTab(tabName) {
  document.querySelectorAll('.tab').forEach(tab => { tab.style.display = 'none'; });
  document.getElementById(tabName).style.display = 'block';
  // Toggle rule containers based on the active tab.
  if(tabName === 'game'){
    document.getElementById('blackjackRulesContainer').style.display = 'block';
    document.getElementById('strategyRulesContainer').style.display = 'none';
  } else if(tabName === 'calculator'){
    document.getElementById('blackjackRulesContainer').style.display = 'none';
    document.getElementById('strategyRulesContainer').style.display = 'block';
    // Reset calculator inputs.
    document.getElementById('playerCard1').value = '';
    document.getElementById('playerCard2').value = '';
    document.getElementById('dealerCard').value = '';
    document.getElementById('bestMove').innerHTML = '';
  }
}

