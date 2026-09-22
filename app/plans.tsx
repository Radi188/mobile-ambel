import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Badge, Button, Card, CardHeader, Divider, IconButton, Screen, SectionLabel,
  Segmented, Skeleton, TopBar,
} from '../components/ui';
import { priceFor, subscriptionService } from '../services/subscription.service';
import { BillingCycle, PlanCatalog, Subscription } from '../types/api.types';
import { colors, money2, plural, radius, space, text } from '../constants/theme';

const CYCLES: { key: BillingCycle; label: string }[] = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
];

const DEVICE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Phone: 'phone-portrait-outline',
  Tablet: 'tablet-landscape-outline',
  'Desktop app': 'desktop-outline',
  'Web app': 'globe-outline',
};

function renewalDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

/** A breakdown line that shows the list price struck through beside what's paid. */
function PriceLine({ label, sub, list, price, strong }: {
  label: string;
  sub?: string;
  list?: number;
  price: number;
  strong?: boolean;
}) {
  return (
    <View style={s.line}>
      <View style={s.lineCopy}>
        <Text style={strong ? text.bodyStrong : text.body} numberOfLines={1}>{label}</Text>
        {!!sub && <Text style={text.micro} numberOfLines={1}>{sub}</Text>}
      </View>
      <View style={s.linePrices}>
        {list != null && list > price && <Text style={s.struck}>{money2(list)}</Text>}
        <Text style={strong ? text.h2 : text.money}>{money2(price)}</Text>
      </View>
    </View>
  );
}

function Stepper({ value, min, onChange }: { value: number; min: number; onChange: (next: number) => void }) {
  return (
    <View style={s.stepper}>
      <IconButton icon="remove" variant="outline" size={36} disabled={value <= min} onPress={() => onChange(value - 1)} label="Remove branch" />
      <Text style={[text.h2, s.stepperValue]}>{value}</Text>
      <IconButton icon="add" variant="outline" size={36} onPress={() => onChange(value + 1)} label="Add branch" />
    </View>
  );
}

function Bullet({ label, icon = 'checkmark' }: { label: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={s.bullet}>
      <View style={s.bulletDot}>
        <Ionicons name={icon} size={12} color={colors.textInverse} />
      </View>
      <Text style={text.body}>{label}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PlansScreen() {
  const router = useRouter();

  const [catalog, setCatalog] = useState<PlanCatalog | null>(null);
  const [current, setCurrent] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // What the customer is configuring, which starts as what they're on today.
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [branches, setBranches] = useState(1);

  const load = useCallback(async () => {
    try {
      const [catalogData, subscription] = await Promise.all([
        subscriptionService.getCatalog(),
        subscriptionService.getSubscription(),
      ]);
      setCatalog(catalogData);
      setCurrent(subscription);
      setCycle(subscription.cycle);
      setBranches(subscription.branches);
    } catch {
      // keep whatever is on screen
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const submit = async () => {
    setSaving(true);
    try {
      const updated = await subscriptionService.requestChange({ cycle, branches });
      setCurrent(updated);
      Alert.alert(
        'Request sent',
        'We’ve noted the change. Our team will confirm it with you before anything is billed.',
      );
    } catch (e: any) {
      Alert.alert('Something went wrong', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const body = () => {
    if (loading || !catalog || !current) {
      return (
        <View style={s.loading}>
          <Skeleton width="100%" height={168} radius={radius.lg} />
          <Skeleton width="100%" height={46} radius={radius.pill} />
          <Skeleton width="100%" height={120} radius={radius.lg} />
          <Skeleton width="100%" height={180} radius={radius.lg} />
        </View>
      );
    }

    const draft = priceFor(catalog, branches);
    const live = priceFor(catalog, current.branches);
    const yearly = cycle === 'yearly';
    const changed = cycle !== current.cycle || branches !== current.branches;
    const activePrice = current.cycle === 'yearly' ? live.yearly : live.monthly;

    return (
      <>
        {/* What they pay today */}
        <Card tone="inverse" style={s.hero}>
          <View style={s.heroTop}>
            <Text style={[text.overline, { color: colors.textInverseDim }]}>Current plan</Text>
            <Badge label={catalog.discountLabel} tone="inverse" />
          </View>
          <Text style={[text.display, { color: colors.textInverse }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {money2(activePrice)}
          </Text>
          <Text style={[text.caption, { color: colors.textInverseSub }]}>
            per {current.cycle === 'yearly' ? 'year' : 'month'} · 1 store ·{' '}
            {plural(current.branches, 'branch', 'branches')}
          </Text>
          <View style={s.heroFoot}>
            <Ionicons name="refresh-outline" size={13} color={colors.textInverseDim} />
            <Text style={[text.micro, { color: colors.textInverseSub }]}>
              Renews {renewalDate(current.renewsAt)}
            </Text>
          </View>
        </Card>

        {/* Configure */}
        <View style={s.group}>
          <SectionLabel>Billing cycle</SectionLabel>
          <Segmented options={CYCLES} value={cycle} onChange={setCycle} />
        </View>

        <Card>
          <CardHeader
            title="Branches"
            subtitle={`${catalog.base.includedBranches} included, then ${money2(catalog.extraBranch.price)} each`}
            right={<Stepper value={branches} min={1} onChange={setBranches} />}
          />
        </Card>

        {/* Breakdown */}
        <Card>
          <CardHeader title="What that costs" subtitle={catalog.discountLabel} />
          <PriceLine
            label="Store plan"
            sub={`1 store · ${plural(catalog.base.includedBranches, 'branch', 'branches')} included`}
            list={catalog.base.listPrice}
            price={catalog.base.price}
          />
          {draft.extra > 0 && (
            <>
              <Divider />
              <PriceLine
                label="Extra branches"
                sub={`${draft.extra} × ${money2(catalog.extraBranch.price)}`}
                list={draft.extra * catalog.extraBranch.listPrice}
                price={draft.extra * catalog.extraBranch.price}
              />
            </>
          )}
          <Divider />
          <PriceLine
            label={yearly ? 'Total per year' : 'Total per month'}
            sub={yearly ? `${money2(draft.monthly)} / month, billed annually` : undefined}
            price={yearly ? draft.yearly : draft.monthly}
            strong
          />
          <Text style={[text.micro, s.saving]}>
            You save {money2(yearly ? draft.savingPerMonth * catalog.yearly.monthsCharged : draft.savingPerMonth)}
            {yearly ? ' a year' : ' a month'} against list price.
          </Text>
        </Card>

        {/* Annual bonus */}
        <Card tone={yearly ? 'default' : 'sunken'} style={yearly ? s.perkOn : undefined}>
          <CardHeader
            title="BongMenu, free on yearly"
            subtitle={yearly ? 'Included with your plan' : 'Switch to yearly to unlock'}
            right={yearly ? <Badge label="Included" tone="solid" /> : undefined}
          />
          <View style={s.perks}>
            {catalog.yearly.perks.map(perk => (
              <Bullet key={perk} label={perk} icon={yearly ? 'checkmark' : 'lock-closed'} />
            ))}
          </View>
        </Card>

        {/* Always included */}
        <Card>
          <CardHeader title="Included at no cost" />
          <View style={s.perks}>
            {catalog.included.map(item => <Bullet key={item} label={item} />)}
          </View>
        </Card>

        {/* Devices */}
        <Card>
          <CardHeader title="Works on every device" />
          <View style={s.devices}>
            {catalog.platforms.map(platform => (
              <View key={platform} style={s.device}>
                <Ionicons name={DEVICE_ICONS[platform] ?? 'ellipse-outline'} size={18} color={colors.text} />
                <Text style={text.caption}>{platform}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Honest about what isn't here yet */}
        {catalog.notYetAvailable.length > 0 && (
          <Card tone="outline" style={s.note}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={[text.small, s.noteText]}>
              {catalog.notYetAvailable.join(', ')} {catalog.notYetAvailable.length === 1 ? 'is' : 'are'} not part of
              BongPOS yet. Everything else above is available today.
            </Text>
          </Card>
        )}

        <Button
          label={changed ? 'Request this change' : 'You’re on this plan'}
          icon={changed ? 'paper-plane-outline' : 'checkmark'}
          size="lg"
          full
          disabled={!changed}
          loading={saving}
          onPress={submit}
        />
        <Text style={[text.micro, s.footnote]}>
          Nothing is charged from the app — our team confirms every change with you first.
        </Text>
      </>
    );
  };

  return (
    <Screen
      tabBar={false}
      refreshing={refreshing}
      onRefresh={onRefresh}
      topBar={<TopBar title="Subscription" onBack={() => router.back()} />}
    >
      {body()}
    </Screen>
  );
}

const s = StyleSheet.create({
  loading: { gap: space.md },
  hero: { gap: space.xs, padding: space.xxl },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  heroFoot: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: space.sm },

  group: { gap: space.xs },

  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.lg, paddingVertical: space.md },
  lineCopy: { flex: 1, gap: 1 },
  linePrices: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  struck: { ...text.caption, textDecorationLine: 'line-through', color: colors.textTertiary },
  saving: { marginTop: space.sm },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepperValue: { minWidth: 22, textAlign: 'center' },

  perks: { gap: space.md, marginTop: space.lg },
  perkOn: { borderColor: colors.text },
  bullet: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  bulletDot: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent,
  },

  devices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, marginTop: space.lg },
  device: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  note: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  noteText: { flex: 1, lineHeight: 19 },
  footnote: { textAlign: 'center', marginTop: -space.sm },
});
