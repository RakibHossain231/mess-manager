# 🏠 Mess Manager (Full Stack Web Application)

A modern, role-based mess management system built to simplify meal tracking, expenses, and monthly settlements for shared living environments.

---

## 🚀 Live Demo

🔗 [Click here](https://rakibhossain231mess-manager.vercel.app)  

---

## 📖 Overview

Managing a shared mess manually can be confusing — tracking meals, expenses, and final balances often leads to mistakes.

**Mess Manager** is a real-life solution that automates everything:
- Meal tracking  
- Expense management  
- Monthly settlement  
- Role-based access  

This project was built with a focus on **usability, real-world logic, and clean UI**.

---

## ✨ Features

### 👤 Role-Based System
- **Admin**
  - Full system control
  - Manage members, meals, expenses, and reports

- **Manager**
  - Add meals and expenses
  - Handle daily operations

- **Member**
  - View personal meal history
  - Check monthly balance and summary

---

### 🍽️ Meal Management
- Daily meal entry
- Member-wise meal tracking
- Monthly total calculation
- Prevent duplicate entries for same date
- Track 0 meals (for full history accuracy)

---

### 💰 Expense & Bazar Tracking
- Add bazar and utility expenses (water, garbage, etc.)
- Member-wise bazar history
- Monthly expense overview

---

### 📊 Reports & Settlement
- Automatic monthly calculations
- Final balance system:
  - Who will pay
  - Who will receive
- Status system:
  - Pending
  - Done
- Prevent overpayment issues

---

### 📱 PWA Support
- Installable on mobile
- Works like a native app

---

### 🔐 Authentication & Security
- Supabase Authentication
- Password reset system
- Secure role-based access
- Row Level Security (RLS) applied

---

## 🛠️ Tech Stack

**Frontend**
- Next.js (App Router)
- Tailwind CSS

**Backend**
- Supabase (Auth + Database)

**Database**
- PostgreSQL (via Supabase)

**Deployment**
- Vercel

---

## ⚙️ Installation & Setup

### 1️⃣ Clone Repository
```bash
git clone https://github.com/RakibHossain231/mess-manager.git
cd mess-manager
```
### 2️⃣ Install Dependencies
```bash
npm install
```
### 3️⃣ Setup Environment Variables
Create a ***.env.local* file and add:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://netfcyimtrtlvhnvnuaw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_YBVkhQR3Ser8nCk3p6qAFw_P5hvF73U
```
### 4️⃣ Run Locally
```bash
npm run dev
```

## 👨‍💻 Author

### Rakib Hossain
GitHub: [Click](https://github.com/RakibHossain231)
LinkedIn: [Click](https://www.linkedin.com/in/rakibhossain231/)
