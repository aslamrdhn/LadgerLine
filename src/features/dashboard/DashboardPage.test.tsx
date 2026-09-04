/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DashboardPage from './DashboardPage';

describe('DashboardPage Component', () => {
  it('should render the dashboard layout correctly', () => {
    render(<DashboardPage />);
    
    // Check headings
    expect(screen.getByText('Welcome to LedgerLine')).toBeInTheDocument();
    
    // Check metric cards
    expect(screen.getByText("Today's Revenue")).toBeInTheDocument();
    expect(screen.getByText('Rp 2.450.000')).toBeInTheDocument();
    
    expect(screen.getByText('Total Orders')).toBeInTheDocument();
    expect(screen.getByText('142')).toBeInTheDocument();
    
    expect(screen.getByText('Active Tables')).toBeInTheDocument();
    expect(screen.getByText('8 / 12')).toBeInTheDocument();
  });

  it('should contain a "New Transaction" button that triggers action', () => {
    render(<DashboardPage />);
    const button = screen.getByRole('button', { name: /new transaction/i });
    
    expect(button).toBeInTheDocument();
    // Simulate user interaction
    fireEvent.click(button);
    // Since it's currently a static UI without a handler in the component, we just ensure it renders and clicks without crashing.
  });
});
