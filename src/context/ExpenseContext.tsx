import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Expense } from '@/types/expense';
import { useSQLiteContext } from 'expo-sqlite';
import {
  deleteExpense as deleteExpenseRecord,
  getAllExpenses,
  insertExpense,
  updateExpense as updateExpenseRecord,
} from '@/database/expenseRepository';
import { deleteStoredReceipt } from '@/database/receiptStorage';

interface ExpenseContextType {
  expenses: Expense[];
  isLoading: boolean;
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  updateExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  getMonthlyTotal: () => number;
  getCurrentMonthExpenses: () => Expense[];
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

function sortByDateDescending(expenses: Expense[]): Expense[] {
  return [...expenses].sort((first, second) => second.date.getTime() - first.date.getTime());
}

export const ExpenseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const db = useSQLiteContext();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadExpenses = async () => {
      try {
        const savedExpenses = await getAllExpenses(db);
        setExpenses(savedExpenses);
      } catch (error) {
        console.error('No se pudieron cargar los gastos', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadExpenses();
  }, [db]);

  const addExpense = async (expense: Omit<Expense, 'id'>) => {
    const newExpense: Expense = {
      ...expense,
      id: Date.now().toString() + Math.random().toString(36).slice(2, 11),
    };

    await insertExpense(db, newExpense);

    setExpenses((previous) => sortByDateDescending([...previous, newExpense]));
  };

  const updateExpense = async (expense: Expense) => {
    const previousExpense = expenses.find((item) => item.id === expense.id);
    await updateExpenseRecord(db, expense);
    setExpenses((previous) =>
      sortByDateDescending(previous.map((item) => (item.id === expense.id ? expense : item)))
    );

    if (previousExpense?.receiptUri && previousExpense.receiptUri !== expense.receiptUri) {
      try {
        await deleteStoredReceipt(previousExpense.receiptUri);
      } catch (error) {
        console.error('No se pudo limpiar el comprobante anterior', error);
      }
    }
  };

  const deleteExpense = async (id: string) => {
    const expense = expenses.find((item) => item.id === id);
    await deleteExpenseRecord(db, id);
    setExpenses((previous) => previous.filter((item) => item.id !== id));

    if (expense?.receiptUri) {
      try {
        await deleteStoredReceipt(expense.receiptUri);
      } catch (error) {
        console.error('No se pudo limpiar el comprobante del gasto', error);
      }
    }
  };

  const getCurrentMonthExpenses = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return expenses.filter((expense) => {
      return (
        expense.date.getMonth() === currentMonth &&
        expense.date.getFullYear() === currentYear
      );
    });
  };

  const getMonthlyTotal = () => {
    return getCurrentMonthExpenses().reduce(
      (total, expense) => total + expense.amount,
      0
    );
  };

  return (
    <ExpenseContext.Provider
      value={{
        expenses,
        isLoading,
        addExpense,
        updateExpense,
        deleteExpense,
        getMonthlyTotal,
        getCurrentMonthExpenses,
      }}
    >
      {children}
    </ExpenseContext.Provider>
  );
};

export const useExpenses = () => {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpenses must be used within an ExpenseProvider');
  }
  return context;
};
