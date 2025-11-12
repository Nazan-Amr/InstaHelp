# Quick Start Guide - New QR & Vital Features

## 🚀 Quick Overview

InstaCure now includes enhanced medical information display with a vital monitoring panel when scanning QR codes.

---

## 👥 User Scenarios

### Scenario 1: Emergency Responder Scanning QR Code (No Login)

**What they see:**
1. **Blood Type Card** 🩸
   - Displays patient's blood type with RH factor
   - Example: "O+" or "AB-"

2. **Allergies Card** ⚠️
   - Color-coded by severity:
     - 🟢 Mild: Light orange
     - 🟡 Moderate: Orange  
     - 🔴 Severe: Dark orange
     - 🔴 Critical: Red (bold)
   - Hover to see reaction details

3. **Emergency Contact Card** 📞
   - Name, relationship, phone number
   - One-click call button

4. **Medical Instructions** 📋
   - Important care instructions

5. **Last Vitals** 📊
   - Heart Rate (bpm)
   - Temperature (°C)
   - Blood Pressure (mmHg)
   - O2 Saturation (%)
   - Respiratory Rate (breaths/min)

6. **Vital Monitor Sidebar** ❤️
   - Floating panel in bottom-right corner
   - Shows critical vitals
   - Collapsible for more space
   - Color-coded status

7. **Nearest Hospitals** 🏥
   - Map showing nearby hospitals
   - Direct navigation links

---

### Scenario 2: Doctor/Owner Scanning QR Code (With Login)

**Additional access:**
1. All public information (above) +
2. **Full Medical Records:**
   - Complete medical history
   - Current medications with dosages
   - Surgical history
   - Chronic conditions
   - Immunization records
   - Doctor notes
   - Scanned medical files

---

## 🎯 How to Use

### For Emergency Responders

1. **Open Emergency Page**: Navigate to emergency view or scan QR code
2. **View Summary Data**: 
   - See blood type and allergies immediately
   - Check emergency contact
   - Review last vitals
   - Monitor vital signs in sidebar
3. **Take Action**:
   - Call emergency contact (one-click button)
   - Get directions to nearest hospital
   - Follow medical instructions

### For Doctors/Owners

1. **Log into InstaCure**: Use doctor or owner account
2. **Scan QR Code**: Same QR codes as emergency responders
3. **Access Full Data**:
   - See additional medical history
   - Review all medications
   - Check surgical records
   - Update notes as needed
4. **Monitor Vitals**: Use sidebar to track vital signs

---

## 📊 Vital Monitor Usage

### Location
- **Bottom-right corner** of screen
- Floating panel that stays visible

### Controls
- **Click header** to collapse/expand
- Shows **critical vitals** when collapsed
- Full details when expanded

### Information Displayed
- Heart Rate (❤️) - Normal range: 60-100 bpm
- Temperature (🌡️) - Normal range: 36.1-37.2°C
- Blood Pressure (🫀) - Normal range: 120/80 mmHg
- O₂ Saturation (💨) - Normal range: 95-100%
- Respiratory Rate (🫁) - Normal range: 12-20 breaths/min

### Status Indicators
- **✓ Green**: All vitals normal
- **⚠ Yellow**: Some vitals slightly abnormal
- **🚨 Red**: Critical vitals - immediate attention needed

---

## 🔒 Privacy & Security

### What's Public (No Login Required)
- Blood type
- RH factor
- Critical allergies
- Emergency contact
- Important instructions
- Recent vitals
- Vital ranges

### What Requires Login
- Full medical history
- All medications
- Surgery records
- Chronic conditions
- Immunization records
- Doctor notes
- Scanned files

### Access Control
- **Patient owners**: Can view their own full data
- **Doctors**: Can view any patient's full data
- **Admins**: Can view any patient's full data
- **Emergency responders**: Can only see emergency summary

---

## 🧮 Normal Vital Ranges

| Vital | Min | Max | Unit |
|-------|-----|-----|------|
| Heart Rate | 60 | 100 | bpm |
| Temperature | 36.1 | 37.2 | °C |
| Systolic BP | - | 120 | mmHg |
| Diastolic BP | - | 80 | mmHg |
| O₂ Saturation | 95 | 100 | % |
| Respiratory Rate | 12 | 20 | breaths/min |

*Note: These are defaults and can be customized per patient*

---

## 🆘 Emergency Response Flow

```
1. Scan QR Code
   ↓
2. Public Emergency Data Displayed
   ↓
3. Check:
   - Blood Type & Allergies
   - Emergency Contact
   - Medical Instructions
   ↓
4. Actions:
   - Call emergency contact (1-click)
   - Get directions to hospital
   - Monitor vitals in sidebar
   ↓
5. If authorized (logged-in doctor):
   - Access full medical history
   - Review current medications
   - Check relevant conditions
```

---

## 🎨 Color Meanings

### Allergy Severity
- 🟠 **M** (Mild): Minor reactions
- 🟠 **Mo** (Moderate): Notable reactions
- 🟠 **S** (Severe): Serious reactions  
- 🔴 **C** (Critical): Life-threatening reactions

### Vital Status
- 🟢 **Normal**: Within healthy range
- 🟡 **Warning**: Outside normal range
- 🔴 **Critical**: Significantly abnormal

---

## 🔧 Customization

### For Patient Owners
When setting up profile, you can customize:
- Vital sign normal ranges
- Allergy severity levels
- Medical instructions
- Emergency contact info
- Medications and dosages
- Chronic conditions
- Surgical history

### For Developers
Edit defaults in:
- `frontend/src/components/VitalMonitor.tsx` - Vital ranges
- `frontend/src/pages/EmergencyPage.tsx` - Status calculations
- `backend/supabase/migrations/003_extend_patient_medical_info.sql` - Database defaults

---

## 📱 Mobile Considerations

- **Vital Monitor**: Collapses to header-only on small screens
- **QR Scanning**: Works with phone camera
- **Emergency Contact**: One-click calling on mobile
- **Hospital Maps**: Full interactive mapping on all devices

---

## 🐛 Troubleshooting

### Vital Monitor Not Showing
- Make sure patient has `last_vitals` data
- Check that vitals are within reasonable ranges
- Try refreshing the page

### Full Data Not Visible
- Ensure you're logged in as doctor/owner
- Check that your account is verified
- Try logging out and back in

### Allergies Not Displaying
- Verify patient profile has allergies set
- Check that allergy severity is set
- Ensure reaction descriptions are filled in

### Blood Pressure Shows as 0/0
- Patient may not have BP readings yet
- Configure normal BP range in patient profile
- Wait for new BP data from device

---

## 📚 Additional Resources

- **Full Documentation**: See `IMPLEMENTATION_SUMMARY.md`
- **Database Schema**: See `backend/supabase/migrations/003_extend_patient_medical_info.sql`
- **API Endpoints**: See `backend/src/controllers/emergency.controller.ts`
- **Component Code**: See `frontend/src/components/VitalMonitor.tsx`

---

## ✨ Key Features at a Glance

✅ Enhanced allergy information with severity levels
✅ Extended vital signs monitoring (HR, Temp, BP, O2, RR)
✅ Floating vital monitor sidebar
✅ Role-based access to full medical records
✅ Emergency responder quick access
✅ One-click emergency contact
✅ Hospital location mapping
✅ Privacy-protected data
✅ Audit logging of all access
✅ Mobile-friendly interface

---

**Need help?** Contact your InstaCure administrator or support team.
