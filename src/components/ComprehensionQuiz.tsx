import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { ComprehensionQuestion } from '../types/breakdown';

interface ComprehensionQuizProps {
  questions: ComprehensionQuestion[];
  onAllCorrect: () => void;
}

export const ComprehensionQuiz: React.FC<ComprehensionQuizProps> = ({ questions, onAllCorrect }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [completed, setCompleted] = useState(false);

  if (!questions || questions.length === 0) {
    return null;
  }

  if (completed) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>📝 Comprehension Check</Text>
        <View style={styles.successMessageContainer}>
          <Text style={styles.successMessage}>
            ✅ Page complete! Reading counted toward your daily goal.
          </Text>
        </View>
      </View>
    );
  }

  const currentQuestion = questions[currentIndex];

  const handleSelectOption = (option: string) => {
    if (status === 'correct' || isChecking) return;
    setSelectedOption(option);
    setStatus('idle');
    setShowHint(false);
  };

  const handleCheckAnswer = async () => {
    if (!selectedOption || isChecking) return;
    
    setIsChecking(true);
    
    // selectedOption is e.g. "A) ...", correctAnswer is e.g. "A"
    const isCorrect = selectedOption.startsWith(currentQuestion.correctAnswer) || 
                      selectedOption === currentQuestion.correctAnswer;
    
    if (isCorrect) {
      setStatus('correct');
      setShowHint(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      setTimeout(() => {
        if (currentIndex < questions.length - 1) {
          setCurrentIndex(prev => prev + 1);
          setSelectedOption(null);
          setStatus('idle');
          setIsChecking(false);
        } else {
          setCompleted(true);
          onAllCorrect();
        }
      }, 1000);
    } else {
      setStatus('wrong');
      setShowHint(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // Allow retry
      setIsChecking(false);
      setSelectedOption(null);
    }
  };

  const getOptionStyle = (option: string) => {
    const isThisOptionCorrect = option.startsWith(currentQuestion.correctAnswer) || option === currentQuestion.correctAnswer;
    
    if (status === 'correct' && isThisOptionCorrect) {
      return [styles.optionButton, styles.optionCorrect];
    }
    if (status === 'wrong' && option === selectedOption) {
      return [styles.optionButton, styles.optionWrong];
    }
    if (selectedOption === option) {
      return [styles.optionButton, styles.optionSelected];
    }
    return styles.optionButton;
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>📝 Comprehension Check</Text>
        <Text style={styles.progressText}>
          Question {currentIndex + 1} of {questions.length}
        </Text>
      </View>

      <Text style={styles.questionText}>{currentQuestion.question}</Text>

      <View style={styles.optionsContainer}>
        {currentQuestion.options.map((option, index) => {
          return (
            <TouchableOpacity
              key={index}
              style={getOptionStyle(option)}
              onPress={() => handleSelectOption(option)}
              disabled={status === 'correct'}
            >
              <Text style={styles.optionText}>{option}</Text>
              {status === 'correct' && (option.startsWith(currentQuestion.correctAnswer) || option === currentQuestion.correctAnswer) && (
                <Ionicons name="checkmark" size={20} color="#4CAF50" style={styles.checkIcon} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {showHint && (
        <Text style={styles.hintText}>💡 {currentQuestion.hint || 'That wasn\'t quite right. Try reading the section again!'}</Text>
      )}

      <TouchableOpacity
        style={[styles.checkButton, (!selectedOption || status === 'correct') && styles.checkButtonDisabled]}
        onPress={handleCheckAnswer}
        disabled={!selectedOption || status === 'correct' || isChecking}
      >
        <Text style={styles.checkButtonText}>Check Answer</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#252542',
    borderColor: '#3a3a5e',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
  },
  header: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  progressText: {
    color: '#a0a0c0',
    fontSize: 14,
  },
  questionText: {
    color: '#ffffff',
    fontSize: 17,
    marginBottom: 16,
  },
  optionsContainer: {
    marginBottom: 16,
  },
  optionButton: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  optionSelected: {
    borderColor: '#6366f1',
  },
  optionCorrect: {
    backgroundColor: 'rgba(76,175,80,0.2)',
    borderColor: '#4CAF50',
  },
  optionWrong: {
    backgroundColor: 'rgba(255,107,107,0.2)',
    borderColor: '#FF6B6B',
  },
  optionLetter: {
    color: '#ffffff',
    fontWeight: 'bold',
    marginRight: 10,
    fontSize: 16,
  },
  optionText: {
    color: '#ffffff',
    fontSize: 16,
    flex: 1,
  },
  checkIcon: {
    marginLeft: 10,
  },
  hintText: {
    color: '#FF9800',
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  checkButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    width: '100%',
  },
  checkButtonDisabled: {
    opacity: 0.4,
  },
  checkButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  successMessageContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  successMessage: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
